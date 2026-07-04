import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository, UserWithRole } from './users.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthUserDto } from '../auth/dto/auth-response.dto';

/** User-facing business logic: profile reads/updates and the public projection. */
@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async getProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found.');
    return UsersService.toPublic(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<AuthUserDto> {
    const existing = await this.users.findById(userId);
    if (!existing) throw new NotFoundException('User not found.');
    const updated = await this.users.update(userId, { ...dto });
    return UsersService.toPublic(updated);
  }

  /** Strips secrets (passwordHash, tokens) — the only shape sent to clients. */
  static toPublic(user: UserWithRole): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      branch: user.branch,
      semester: user.semester,
    };
  }
}
