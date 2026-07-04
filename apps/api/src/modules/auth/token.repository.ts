import { Injectable } from '@nestjs/common';
import { RefreshToken, Session } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

/** Prisma access for Session and RefreshToken — the auth persistence boundary. */
@Injectable()
export class TokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  createSession(data: {
    userId: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<Session> {
    return this.prisma.session.create({ data });
  }

  revokeSession(sessionId: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  findSession(sessionId: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id: sessionId } });
  }

  createRefreshToken(data: {
    userId: string;
    sessionId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Atomically rotate: revoke the old token, link it to its replacement, and
   * persist the new token. A transaction keeps the rotation chain consistent.
   */
  async rotate(params: {
    oldTokenId: string;
    userId: string;
    sessionId: string;
    newTokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      const replacement = await tx.refreshToken.create({
        data: {
          userId: params.userId,
          sessionId: params.sessionId,
          tokenHash: params.newTokenHash,
          expiresAt: params.expiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: params.oldTokenId },
        data: { revokedAt: new Date(), replacedById: replacement.id },
      });
      return replacement;
    });
  }

  /** Revoke every active refresh token for a session (logout / reuse defence). */
  async revokeAllForSession(sessionId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
