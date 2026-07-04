import { Injectable } from '@nestjs/common';
import { Document, Prisma, RoleName } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  isActive: boolean;
  branch: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  documentCount: number;
  chatCount: number;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{ items: AdminUserRow[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' } },
              { fullName: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          role: { select: { name: true } },
          _count: { select: { documents: true, chats: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        role: row.role.name,
        isActive: row.isActive,
        branch: row.branch,
        lastLoginAt: row.lastLoginAt,
        createdAt: row.createdAt,
        documentCount: row._count.documents,
        chatCount: row._count.chats,
      })),
    };
  }

  async setRole(userId: string, role: RoleName): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: { connect: { name: role } } },
    });
  }

  async setActive(userId: string, isActive: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  async listDocuments(params: {
    page: number;
    pageSize: number;
  }): Promise<{ items: Document[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.document.count({ where: { deletedAt: null } }),
    ]);
    return { items, total };
  }

  async recordAdminAction(input: {
    actorId: string;
    action: string;
    entity?: string;
    entityId?: string;
    changes?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.adminLog.create({ data: input });
  }
}
