import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatRole, MessageStatus, Prisma } from '@prisma/client';
import { paginate, type PaginatedResponse } from '@/common/dto/api-response';
import { ChatsRepository } from './chats.repository';
import { CreateChatDto, ListChatsDto, UpdateChatDto } from './dto/chat.dto';
import type { ChatTurn } from '../ai/ai.types';

export interface ChatSummary {
  id: string;
  title: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageView {
  id: string;
  role: ChatRole;
  content: string;
  status: MessageStatus;
  metadata: unknown;
  createdAt: Date;
}

const HISTORY_TURNS = 10;

@Injectable()
export class ChatsService {
  constructor(private readonly chats: ChatsRepository) {}

  async create(userId: string, dto: CreateChatDto): Promise<ChatSummary> {
    const chat = await this.chats.createChat(userId, dto.title?.trim() || 'New chat');
    return ChatsService.toSummary(chat);
  }

  async list(
    userId: string,
    dto: ListChatsDto,
  ): Promise<PaginatedResponse<ChatSummary>> {
    const { items, total } = await this.chats.list({
      userId,
      page: dto.page,
      pageSize: dto.pageSize,
      search: dto.search,
    });
    return paginate(
      items.map(ChatsService.toSummary),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async getWithMessages(
    userId: string,
    chatId: string,
  ): Promise<ChatSummary & { messages: MessageView[] }> {
    const chat = await this.requireChat(userId, chatId);
    const messages = await this.chats.listMessages(chatId);
    return {
      ...ChatsService.toSummary(chat),
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        status: message.status,
        metadata: message.metadata,
        createdAt: message.createdAt,
      })),
    };
  }

  async update(
    userId: string,
    chatId: string,
    dto: UpdateChatDto,
  ): Promise<ChatSummary> {
    await this.requireChat(userId, chatId);
    const chat = await this.chats.updateChat(chatId, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
    });
    return ChatsService.toSummary(chat);
  }

  async remove(userId: string, chatId: string): Promise<void> {
    await this.requireChat(userId, chatId);
    await this.chats.softDelete(chatId);
  }

  /**
   * Persist the user's message and return the conversation history to send to
   * the AI service. Called just before streaming the assistant response.
   */
  async beginUserMessage(
    userId: string,
    chatId: string,
    content: string,
  ): Promise<{ history: ChatTurn[]; isFirstMessage: boolean }> {
    await this.requireChat(userId, chatId);

    const priorTurns = await this.chats.recentTurns(chatId, HISTORY_TURNS);
    const isFirstMessage = priorTurns.length === 0;

    await this.chats.addMessage({
      chatId,
      role: ChatRole.USER,
      content,
      status: MessageStatus.COMPLETE,
    });

    // Oldest-first, excluding the just-added message.
    const history: ChatTurn[] = priorTurns
      .reverse()
      .map((message) => ({
        role: message.role === ChatRole.USER ? 'user' : 'assistant',
        content: message.content,
      }));

    return { history, isFirstMessage };
  }

  /** Persist the finished assistant message and bump the chat. */
  async completeAssistantMessage(
    chatId: string,
    payload: {
      content: string;
      status: MessageStatus;
      metadata: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.chats.addMessage({
      chatId,
      role: ChatRole.ASSISTANT,
      content: payload.content,
      status: payload.status,
      metadata: payload.metadata as Prisma.InputJsonValue,
    });
    await this.chats.touchChat(chatId);
  }

  /** Derive a chat title from the first user message. */
  async autoTitle(chatId: string, firstMessage: string): Promise<void> {
    const title = firstMessage.trim().slice(0, 60);
    await this.chats.updateChat(chatId, { title: title || 'New chat' });
  }

  private async requireChat(userId: string, chatId: string) {
    const chat = await this.chats.findChat(chatId, userId);
    if (!chat) throw new NotFoundException('Chat not found.');
    return chat;
  }

  private static toSummary(chat: {
    id: string;
    title: string;
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ChatSummary {
    return {
      id: chat.id,
      title: chat.title,
      isPinned: chat.isPinned,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }
}
