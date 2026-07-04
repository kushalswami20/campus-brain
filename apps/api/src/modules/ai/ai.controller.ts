import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AiService } from './ai.service';
import { AiQueryDto } from './dto/ai-query.dto';
import type { AiReadiness, RagAnswer } from './ai.types';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('health')
  @ApiOperation({ summary: 'Downstream AI-service readiness.' })
  health(@Req() req: Request & { id?: string }): Promise<AiReadiness> {
    return this.ai.health(req.id ?? 'unknown');
  }

  @Post('query/sync')
  @ApiOperation({ summary: 'Non-streaming grounded answer.' })
  query(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiQueryDto,
    @Req() req: Request & { id?: string },
  ): Promise<RagAnswer> {
    return this.ai.query({
      requestId: req.id ?? 'unknown',
      userId: user.userId,
      query: dto.query,
      chatId: dto.chatId,
      stream: false,
    });
  }

  @Post('query/stream')
  @ApiOperation({ summary: 'Stream a grounded answer as Server-Sent Events.' })
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiQueryDto,
    @Req() req: Request & { id?: string },
    @Res() res: Response,
  ): Promise<void> {
    const requestId = req.id ?? 'unknown';
    const upstream = await this.ai.streamQuery({
      requestId,
      userId: user.userId,
      query: dto.query,
      chatId: dto.chatId,
      stream: true,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('x-request-id', requestId);
    res.flushHeaders();

    // Pipe the upstream web ReadableStream to the Express response. If the
    // client disconnects, abort reading so we don't leak the upstream stream.
    const nodeStream = Readable.fromWeb(
      upstream.body as Parameters<typeof Readable.fromWeb>[0],
    );
    res.on('close', () => nodeStream.destroy());
    nodeStream.pipe(res);
  }
}
