import { Injectable, Logger } from '@nestjs/common';
import { UsageKind } from '@prisma/client';
import { AnalyticsRepository, type UsageRecord } from './analytics.repository';

/**
 * Write-side analytics. Recording is best-effort and never blocks the primary
 * request path — a metrics failure must not fail a chat or an upload.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly repo: AnalyticsRepository) {}

  async recordUsage(record: UsageRecord): Promise<void> {
    try {
      await this.repo.recordUsage(record);
    } catch (error) {
      this.logger.warn(
        `Failed to record usage: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async recordChat(input: {
    userId: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs?: number;
    costUsd?: number;
    requestId?: string;
    grounded?: boolean;
  }): Promise<void> {
    const totalTokens =
      (input.promptTokens ?? 0) + (input.completionTokens ?? 0);
    await this.recordUsage({
      userId: input.userId,
      kind: UsageKind.CHAT,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens,
      costUsd: input.costUsd,
      latencyMs: input.latencyMs,
      requestId: input.requestId,
    });
    await this.recordEvent({
      metric: 'chat.grounded',
      value: input.grounded ? 1 : 0,
      userId: input.userId,
    });
  }

  async recordEvent(input: {
    metric: string;
    value?: number;
    dimension?: string;
    userId?: string;
  }): Promise<void> {
    try {
      await this.repo.recordEvent(input);
    } catch (error) {
      this.logger.warn(
        `Failed to record event: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  overview() {
    return this.repo.overview();
  }

  messagesPerDay(days: number) {
    return this.repo.messagesPerDay(Math.min(Math.max(days, 1), 90));
  }

  documentsByType() {
    return this.repo.documentsByType();
  }

  usageByKind() {
    return this.repo.usageByKind();
  }
}
