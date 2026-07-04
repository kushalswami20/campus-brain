import { RoleName } from '@prisma/client';

/** Shape encoded into the access-token JWT and attached to the request. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: RoleName;
  sessionId: string;
}

/** Access-token JWT payload (`sub` = user id, per JWT convention). */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: RoleName;
  sid: string;
}
