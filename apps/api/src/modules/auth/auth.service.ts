import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { AuthResultDto } from './dto/auth-response.dto';

interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

/** Orchestrates registration, login, refresh, and logout. */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto, ctx: RequestContext): Promise<AuthResultDto> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      branch: dto.branch,
      semester: dto.semester,
      roleName: RoleName.STUDENT,
    });

    const tokens = await this.tokens.issueForNewSession(
      { userId: user.id, email: user.email, role: user.role.name },
      ctx,
    );
    return { user: UsersService.toPublic(user), tokens };
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthResultDto> {
    const user = await this.users.findByEmail(dto.email);
    // Uniform failure regardless of which factor is wrong (no user enumeration).
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const valid = await this.passwords.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated.');
    }

    await this.users.markLoggedIn(user.id);
    const tokens = await this.tokens.issueForNewSession(
      { userId: user.id, email: user.email, role: user.role.name },
      ctx,
    );
    return { user: UsersService.toPublic(user), tokens };
  }

  async refresh(rawRefreshToken: string): Promise<AuthResultDto> {
    const rotated = await this.tokens.rotate(rawRefreshToken);
    const user = await this.users.findById(rotated.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active.');
    }
    const tokens = await this.tokens.buildTokens(
      {
        userId: user.id,
        email: user.email,
        role: user.role.name,
        sessionId: rotated.sessionId,
      },
      rotated.refreshToken,
    );
    return { user: UsersService.toPublic(user), tokens };
  }

  async logout(sessionId: string): Promise<void> {
    await this.tokens.revokeSession(sessionId);
  }
}
