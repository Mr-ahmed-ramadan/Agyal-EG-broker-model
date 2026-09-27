import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { catchError, tap, throwError, type Observable } from 'rxjs';
import type { AppRequest } from './auth';
import { DbService } from './db.service';
import { currentContext } from './request-context';

/** Admin reads of personal data are audited too (who looked at whom). */
const AUDITED_READS = [/^\/admin\/data\//, /^\/admin\/compliance\/clients\/[^/]+$/, /^\/admin\/audit\/export/];

export function shouldAudit(method: string, path: string): boolean {
  if (path === '/health' || path.startsWith('/d/')) return false;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') return true;
  return AUDITED_READS.some((r) => r.test(path));
}

/**
 * Writes one AuditLog row per state-changing request (and per audited read):
 * actor, broker, route, HTTP outcome, IP and user agent. Request bodies are
 * never stored (they can hold passwords or codes); only the email used on
 * sign-in/registration is kept so failed attempts can be traced.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly log = new Logger('Audit');

  constructor(private readonly db: DbService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AppRequest & Request>();
    const path = (req.originalUrl ?? req.url).split('?')[0];
    if (!shouldAudit(req.method, path)) return next.handle();

    const write = (outcome: number) => {
      const ctx = currentContext();
      const route = (req.route as { path?: string } | undefined)?.path ?? path;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const email = /^\/auth\/(login|register)/.test(path) && typeof body.email === 'string' ? body.email.toLowerCase() : undefined;
      const data: Prisma.InputJsonValue = { path, ...(email ? { email } : {}) };
      void this.db.auditLog
        .create({
          data: {
            tenantId: req.tenant?.id ?? req.user?.tenantId ?? null,
            actorId: req.user?.sub ?? ctx?.actorId ?? null,
            action: `${req.method} ${route}`,
            entity: 'Request',
            entityId: ctx?.requestId ?? '-',
            data,
            ip: ctx?.ip ?? req.ip ?? null,
            userAgent: ctx?.userAgent ?? null,
            outcome,
            requestId: ctx?.requestId ?? null,
          },
        })
        .catch((err) => this.log.error(`Could not write audit log: ${(err as Error).message}`));
    };

    return next.handle().pipe(
      tap(() => write(http.getResponse<Response>().statusCode)),
      catchError((err) => {
        write(err instanceof HttpException ? err.getStatus() : 500);
        return throwError(() => err);
      }),
    );
  }
}
