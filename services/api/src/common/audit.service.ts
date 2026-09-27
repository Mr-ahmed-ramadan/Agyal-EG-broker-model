import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Tx } from './db.service';
import { currentContext } from './request-context';

/** Immutable audit trail for state-changing actions (ADR 0001). */
@Injectable()
export class AuditService {
  async record(
    tx: Tx,
    entry: {
      tenantId: string | null;
      actorId: string | null;
      action: string;
      entity: string;
      entityId: string;
      data?: Prisma.InputJsonValue;
    },
  ) {
    const ctx = currentContext();
    await tx.auditLog.create({
      data: { ...entry, ip: ctx?.ip ?? null, userAgent: ctx?.userAgent ?? null, requestId: ctx?.requestId ?? null },
    });
  }
}
