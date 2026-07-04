import { Injectable } from '@nestjs/common';
import { Chat, ChatRole, Message, MessageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

interface ListParams {
  userId: string;
  page: number;
  pageSize: number;
  search?: string;
}

/** Prisma access for Chat and Message. */
@Injectable()
export class ChatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createChat(userId: string, title: string): Promise<Chat> {
    return this.prisma.chat.create({ data: { userId, title } });
  }

  findChat(id: string, userId: string): Promise<Chat | null> {
    return this.prisma.chat.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async list(params: ListParams): Promise<{ items: Chat[]; total: number }> {
    const where: Prisma.ChatWhereInput = {
      userId: params.userId,
      deletedAt: null,
      ...(params.search
        ? { title: { contains: params.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.chat.findMany({
        where,
        // Pinned first, then most recently updated.
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.chat.count({ where }),
    ]);
    return { items, total };
  }

  listMessages(chatId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  updateChat(id: string, data: Prisma.ChatUpdateInput): Promise<Chat> {
    return this.prisma.chat.update({ where: { id }, data });
  }

  touchChat(id: string): Promise<Chat> {
    return this.prisma.chat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.chat.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  addMessage(input: {
    chatId: string;
    role: ChatRole;
    content: string;
    status?: MessageStatus;
    metadata?: Prisma.InputJsonValue;
  }): Promise<Message> {
    return this.prisma.message.create({
      data: {
        chatId: input.chatId,
        role: input.role,
        content: input.content,
        status: input.status ?? MessageStatus.COMPLETE,
        metadata: input.metadata,
      },
    });
  }

  updateMessage(
    id: string,
    data: Prisma.MessageUpdateInput,
  ): Promise<Message> {
    return this.prisma.message.update({ where: { id }, data });
  }

  recentTurns(chatId: string, limit: number): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { chatId, status: MessageStatus.COMPLETE },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
