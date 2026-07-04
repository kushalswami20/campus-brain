import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminService } from './admin.service';
import { ListUsersDto, SetRoleDto, SetStatusDto } from './dto/admin.dto';

/**
 * Admin surface. The class-level @Roles gate means every route requires an
 * ADMIN (or SUPER_ADMIN, which the RolesGuard treats as a superset).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(RoleName.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Platform-wide KPIs.' })
  overview() {
    return this.admin.overview();
  }

  @Get('analytics/messages')
  @ApiOperation({ summary: 'Messages per day (time series).' })
  messages(@Query('days') days?: string) {
    return this.admin.messagesPerDay(days ? Number(days) : 14);
  }

  @Get('analytics/documents-by-type')
  @ApiOperation({ summary: 'Document counts by type.' })
  documentsByType() {
    return this.admin.documentsByType();
  }

  @Get('analytics/usage-by-kind')
  @ApiOperation({ summary: 'AI usage counts by kind.' })
  usageByKind() {
    return this.admin.usageByKind();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users with activity counts.' })
  listUsers(@Query() dto: ListUsersDto) {
    return this.admin.listUsers(dto);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change a user role (super admin for privilege grants).' })
  setRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
  ): Promise<void> {
    return this.admin.setUserRole(
      { userId: actor.userId, role: actor.role },
      id,
      dto.role,
    );
  }

  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate a user.' })
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
  ): Promise<void> {
    return this.admin.setUserStatus(actor.userId, id, dto.isActive);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List all documents across users.' })
  listDocuments(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listDocuments(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }
}
