import { Injectable } from '@nestjs/common';
import { Prisma, RoleName, User } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

/** Row shape with the role name joined — the common read model for auth. */
export type UserWithRole = User & { role: { name: RoleName } };

/**
 * Data-access for users. The only place that touches Prisma for the User model;
 * business rules live in UsersService, not here.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: { select: { name: true } } },
    });
  }

  findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: { select: { name: true } } },
    });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    branch?: string;
    semester?: number;
    roleName: RoleName;
  }): Promise<UserWithRole> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        branch: data.branch,
        semester: data.semester,
        role: { connect: { name: data.roleName } },
      },
      include: { role: { select: { name: true } } },
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { role: { select: { name: true } } },
    });
  }

  markLoggedIn(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
