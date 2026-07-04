import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessageStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PaginatedResponse } from '@/common/dto/api-response';
import { AiService } from '../ai/ai.service';
import { ChatsService, type ChatSummary, type MessageView } from './chats.service';
import { SseAccumulator } from './sse-accumulator';
import {
  CreateChatDto,
  ListChatsDto,
  SendMessageDto,
  UpdateChatDto,
} from './dto/chat.dto';

@ApiTags('chats')
@ApiBearerAuth()
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chats: ChatsService,
    private readonly ai: AiService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new chat.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChatDto,
  ): Promise<ChatSummary> {
    return this.chats.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List chats (pinned first), searchable by title.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: ListChatsDto,
  ): Promise<PaginatedResponse<ChatSummary>> {
    return this.chats.list(user.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a chat with its full message history.' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ChatSummary & { messages: MessageView[] }> {
    return this.chats.getWithMessages(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or pin/unpin a chat.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateChatDto,
  ): Promise<ChatSummary> {
    return this.chats.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a chat.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.chats.remove(user.userId, id);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Send a message and stream the grounded answer (SSE).',
  })
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') chatId: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request & { id?: string },
    @Res() res: Response,
  ): Promise<void> {
    const requestId = req.id ?? 'unknown';

    // Persist the user turn and gather conversation context first (throws 404
    // before any streaming starts if the chat isn't owned by the user).
    const { history, isFirstMessage } = await this.chats.beginUserMessage(
      user.userId,
      chatId,
      dto.content,
    );
    if (isFirstMessage) {
      await this.chats.autoTitle(chatId, dto.content);
    }

    const upstream = await this.ai.streamQuery({
      requestId,
      userId: user.userId,
      query: dto.content,
      chatId,
      history,
      stream: true,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('x-request-id', requestId);
    res.flushHeaders();

    const accumulator = new SseAccumulator();
    const nodeStream = Readable.fromWeb(
      upstream.body as Parameters<typeof Readable.fromWeb>[0],
    );
    const decoder = new TextDecoder();

    let clientGone = false;
    res.on('close', () => {
      clientGone = true;
      nodeStream.destroy();
    });

    try {
      for await (const chunk of nodeStream) {
        const text = decoder.decode(chunk as Buffer, { stream: true });
        accumulator.push(text);
        if (!clientGone) res.write(text);
      }
    } catch {
      // Stream aborted (client disconnect or upstream error); persist whatever
      // was accumulated below so the conversation isn't lost.
    }

    const finished = accumulator.result();
    await this.chats.completeAssistantMessage(chatId, {
      content: finished.content,
      status: finished.errored ? MessageStatus.ERROR : MessageStatus.COMPLETE,
      metadata: {
        citations: finished.citations,
        usage: finished.usage,
        grounded: finished.grounded,
        trace: finished.trace,
        requestId,
      },
    });

    if (!clientGone) res.end();
  }
}
