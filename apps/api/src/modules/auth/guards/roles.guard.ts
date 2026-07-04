import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Authorization guard. Runs after JwtAuthGuard; checks the authenticated user's
 * role against the roles declared via `@Roles(...)`. SUPER_ADMIN implies ADMIN.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required.');

    if (this.satisfies(user.role, required)) return true;
    throw new ForbiddenException('Insufficient permissions.');
  }

  private satisfies(role: RoleName, required: RoleName[]): boolean {
    if (required.includes(role)) return true;
    // SUPER_ADMIN is a superset of ADMIN.
    return role === RoleName.SUPER_ADMIN && required.includes(RoleName.ADMIN);
  }
}
