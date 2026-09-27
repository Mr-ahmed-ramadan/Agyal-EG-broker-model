import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Who is doing what, for the audit trail: set per HTTP request by
 * RequestContextMiddleware, completed by the AuthGuard once the user is known,
 * and read by DbService (app.actor_id / app.request_id for the data-change
 * trigger) and the AuditInterceptor.
 */
export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  actorId?: string;
  tenantId?: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}

export function newRequestContext(ip: string | null, userAgent: string | null): RequestContext {
  return { requestId: randomUUID(), ip, userAgent: userAgent ? userAgent.slice(0, 300) : null };
}
