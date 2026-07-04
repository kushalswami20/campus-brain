import { Injectable } from '@nestjs/common';
import { Prisma, UsageKind } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface UsageRecord {
  userId: string;
  kind: UsageKind;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  requestId?: string;
}

/** Prisma access + aggregate queries for UsageLog and Analytics. */
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordUsage(record: UsageRecord): Promise<void> {
    await this.prisma.usageLog.create({ data: record });
  }

  async recordEvent(input: {
    metric: string;
    value?: number;
    dimension?: string;
    userId?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.analytics.create({ data: input });
  }

  async overview(): Promise<{
    totalUsers: number;
    activeToday: number;
    documents: number;
    chats: number;
    messages: number;
    totalTokens: number;
    estCostUsd: number;
    avgLatencyMs: number;
  }> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      documents,
      chats,
      messages,
      usageAgg,
      activeRows,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.document.count({ where: { deletedAt: null } }),
      this.prisma.chat.count({ where: { deletedAt: null } }),
      this.prisma.message.count(),
      this.prisma.usageLog.aggregate({
        _sum: { totalTokens: true, costUsd: true },
        _avg: { latencyMs: true },
      }),
      this.prisma.usageLog.findMany({
        where: { createdAt: { gte: startOfToday } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);

    return {
      totalUsers,
      activeToday: activeRows.length,
      documents,
      chats,
      messages,
      totalTokens: usageAgg._sum.totalTokens ?? 0,
      estCostUsd: Number((usageAgg._sum.costUsd ?? 0).toFixed(4)),
      avgLatencyMs: Math.round(usageAgg._avg.latencyMs ?? 0),
    };
  }

  /** Messages per day for the last N days. */
  async messagesPerDay(days: number): Promise<{ date: string; count: number }[]> {
    const rows = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS date, COUNT(*)::int AS count
      FROM messages
      WHERE "createdAt" >= NOW() - (${days} || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      count: Number(row.count),
    }));
  }

  /** Document counts grouped by type. */
  async documentsByType(): Promise<{ type: string; count: number }[]> {
    const grouped = await this.prisma.document.groupBy({
      by: ['type'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    return grouped
      .map((row) => ({ type: row.type, count: row._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  /** Usage by kind (chat, quiz, flashcard, …). */
  async usageByKind(): Promise<{ kind: string; count: number }[]> {
    const grouped = await this.prisma.usageLog.groupBy({
      by: ['kind'],
      _count: { _all: true },
    });
    return grouped
      .map((row) => ({ kind: row.kind, count: row._count._all }))
      .sort((a, b) => b.count - a.count);
  }
}
