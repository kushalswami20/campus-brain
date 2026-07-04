import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfigService } from '@/config/config.module';
import { TokenRepository } from './token.repository';
import type { AccessTokenPayload } from './auth.types';
import type { AuthTokensDto } from './dto/auth-response.dto';

interface IssueParams {
  userId: string;
  email: string;
  role: RoleName;
  sessionId: string;
}

/**
 * Owns the token lifecycle: signs short-lived access JWTs and issues opaque
 * refresh tokens whose SHA-256 hash (never the raw value) is stored. Refresh
 * uses rotation with reuse detection — a replayed token revokes the session.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly tokens: TokenRepository,
  ) {}

  /** Create a session + first token pair (called on register/login). */
  async issueForNewSession(
    params: Omit<IssueParams, 'sessionId'>,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokensDto> {
    const session = await this.tokens.createSession({
      userId: params.userId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: this.refreshExpiry(),
    });
    return this.issue({ ...params, sessionId: session.id });
  }

  /**
   * Validate + rotate a refresh token. Returns the new raw refresh token and the
   * owning session/user ids; the caller (AuthService) loads the identity and
   * signs the matching access token via {@link buildTokens}.
   */
  async rotate(rawRefreshToken: string): Promise<{
    userId: string;
    sessionId: string;
    refreshToken: string;
  }> {
    const existing = await this.tokens.findRefreshByHash(
      this.hash(rawRefreshToken),
    );

    if (!existing || !existing.sessionId) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // Reuse detection: a token already revoked or replaced means the chain was
    // replayed. Revoke the whole session to contain a potential theft.
    if (existing.revokedAt || existing.replacedById) {
      await this.tokens.revokeAllForSession(existing.sessionId);
      throw new UnauthorizedException('Refresh token reuse detected.');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired.');
    }

    const session = await this.tokens.findSession(existing.sessionId);
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session is no longer active.');
    }

    const raw = this.randomToken();
    await this.tokens.rotate({
      oldTokenId: existing.id,
      userId: existing.userId,
      sessionId: existing.sessionId,
      newTokenHash: this.hash(raw),
      expiresAt: this.refreshExpiry(),
    });

    return {
      userId: existing.userId,
      sessionId: existing.sessionId,
      refreshToken: raw,
    };
  }

  /** Sign an access token for a known identity and pair it with a refresh token. */
  async buildTokens(
    params: IssueParams,
    refreshToken: string,
  ): Promise<AuthTokensDto> {
    const accessToken = await this.signAccess({
      sub: params.userId,
      email: params.email,
      role: params.role,
      sid: params.sessionId,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get('JWT_ACCESS_TTL'),
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.tokens.revokeAllForSession(sessionId);
    await this.tokens.revokeSession(sessionId);
  }

  private async issue(params: IssueParams): Promise<AuthTokensDto> {
    const raw = this.randomToken();
    await this.tokens.createRefreshToken({
      userId: params.userId,
      sessionId: params.sessionId,
      tokenHash: this.hash(raw),
      expiresAt: this.refreshExpiry(),
    });
    const accessToken = await this.signAccess({
      sub: params.userId,
      email: params.email,
      role: params.role,
      sid: params.sessionId,
    });
    return {
      accessToken,
      refreshToken: raw,
      expiresIn: this.config.get('JWT_ACCESS_TTL'),
    };
  }

  private signAccess(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL'),
    });
  }

  private randomToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private refreshExpiry(): Date {
    const days = this.config.get('JWT_REFRESH_TTL_DAYS');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
