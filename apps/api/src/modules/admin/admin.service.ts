import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { paginate, type PaginatedResponse } from '@/common/dto/api-response';
import { AnalyticsService } from '../analytics/analytics.service';
import { UsersRepository } from '../users/users.repository';
import { AdminRepository, type AdminUserRow } from './admin.repository';
import { ListUsersDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly users: UsersRepository,
    private readonly analytics: AnalyticsService,
  ) {}

  // ── analytics reads ──
  overview() {
    return this.analytics.overview();
  }
  messagesPerDay(days: number) {
    return this.analytics.messagesPerDay(days);
  }
  documentsByType() {
    return this.analytics.documentsByType();
  }
  usageByKind() {
    return this.analytics.usageByKind();
  }

  // ── user management ──
  async listUsers(
    dto: ListUsersDto,
  ): Promise<PaginatedResponse<AdminUserRow>> {
    const { items, total } = await this.admin.listUsers({
      page: dto.page,
      pageSize: dto.pageSize,
      search: dto.search,
    });
    return paginate(items, total, dto.page, dto.pageSize);
  }

  /**
   * Change a user's role. Only a SUPER_ADMIN may grant ADMIN/SUPER_ADMIN, and no
   * one may change their own role (prevents accidental self-lockout/escalation).
   */
  async setUserRole(
    actor: { userId: string; role: RoleName },
    targetUserId: string,
    role: RoleName,
  ): Promise<void> {
    if (targetUserId === actor.userId) {
      throw new ForbiddenException('You cannot change your own role.');
    }
    const grantsPrivilege = role === RoleName.ADMIN || role === RoleName.SUPER_ADMIN;
    if (grantsPrivilege && actor.role !== RoleName.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only a super admin can grant admin privileges.',
      );
    }

    const target = await this.users.findById(targetUserId);
    if (!target) throw new NotFoundException('User not found.');

    await this.admin.setRole(targetUserId, role);
    await this.admin.recordAdminAction({
      actorId: actor.userId,
      action: 'user.role.change',
      entity: 'User',
      entityId: targetUserId,
      changes: { from: target.role.name, to: role },
    });
  }

  async setUserStatus(
    actorId: string,
    targetUserId: string,
    isActive: boolean,
  ): Promise<void> {
    if (targetUserId === actorId) {
      throw new ForbiddenException('You cannot deactivate your own account.');
    }
    const target = await this.users.findById(targetUserId);
    if (!target) throw new NotFoundException('User not found.');

    await this.admin.setActive(targetUserId, isActive);
    await this.admin.recordAdminAction({
      actorId,
      action: isActive ? 'user.activate' : 'user.deactivate',
      entity: 'User',
      entityId: targetUserId,
    });
  }

  async listDocuments(page: number, pageSize: number) {
    const { items, total } = await this.admin.listDocuments({ page, pageSize });
    return paginate(items, total, page, pageSize);
  }
}
