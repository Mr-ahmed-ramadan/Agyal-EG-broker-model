import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Tenant } from '@prisma/client';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { currentContext } from './request-context';

export type Role =
  | 'CLIENT'
  | 'BROKER_ADMIN'
  | 'BROKER_COMPLIANCE'
  | 'BROKER_DEALER'
  | 'BROKER_OPS'
  | 'BROKER_FINANCE'
  | 'PLATFORM_ADMIN';

export const BROKER_STAFF: Role[] = [
  'BROKER_ADMIN',
  'BROKER_COMPLIANCE',
  'BROKER_DEALER',
  'BROKER_OPS',
  'BROKER_FINANCE',
];

export interface AuthUser {
  sub: string;
  tenantId: string | null;
  roles: Role[];
  clientId?: string;
}

export interface AppRequest extends Request {
  tenant?: Tenant;
  user?: AuthUser;
}

const TOKEN_TTL_SECONDS = 60 * 60;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set');
  return 'dev-only-secret';
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, secret(), { expiresIn: TOKEN_TTL_SECONDS, audience: 'agyal-api' });
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, secret(), { audience: 'agyal-api' }) as AuthUser & jwt.JwtPayload;
  return { sub: payload.sub, tenantId: payload.tenantId, roles: payload.roles, clientId: payload.clientId };
}

const ROLES_KEY = 'roles';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) throw new UnauthorizedException();
    let user: AuthUser;
    try {
      user = verifyToken(header.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // A tenant user's token is only valid on that tenant's host (ADR 0002).
    if (user.tenantId && req.tenant && req.tenant.id !== user.tenantId) {
      throw new ForbiddenException('Token does not belong to this broker');
    }
    if (user.tenantId && !req.tenant) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const roles = this.reflector.get<Role[]>(ROLES_KEY, context.getHandler()) ??
      this.reflector.get<Role[]>(ROLES_KEY, context.getClass()) ?? [];
    if (roles.length > 0 && !roles.some((r) => user.roles.includes(r))) {
      throw new ForbiddenException('Insufficient role');
    }
    req.user = user;
    const ctx = currentContext();
    if (ctx) {
      ctx.actorId = user.sub;
      ctx.tenantId = user.tenantId;
    }
    return true;
  }
}

/** Requires a valid token and, if given, at least one of the roles. */
export function Auth(...roles: Role[]) {
  return applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(AuthGuard));
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AppRequest>().user!;
});

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const tenant = ctx.switchToHttp().getRequest<AppRequest>().tenant;
  if (!tenant) throw new ForbiddenException('Tenant could not be resolved');
  return tenant;
});
