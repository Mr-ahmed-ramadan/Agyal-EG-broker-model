import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Tx } from './db.service';

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
    await tx.auditLog.create({ data: entry });
  }
}
