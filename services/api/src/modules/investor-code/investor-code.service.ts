import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Depository } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import type { Tx } from '../../common/db.service';
import { MCDR_ADAPTER, type McdrAdapter } from './mcdr.adapter';

/** Format check only; MCDR verification happens through the adapter. */
export function isPlausibleUnifiedCode(code: string): boolean {
  return /^\d{6,12}$/.test(code);
}

@Injectable()
export class InvestorCodeService {
  constructor(
    @Inject(MCDR_ADAPTER) private readonly mcdr: McdrAdapter,
    private readonly audit: AuditService,
  ) {}

  /** Onboarding step: the client declares an existing code or asks for a new one. */
  async capture(tx: Tx, clientId: string, input: { hasExistingCode: boolean; code?: string }) {
    if (input.hasExistingCode) {
      if (!input.code || !isPlausibleUnifiedCode(input.code)) {
        throw new BadRequestException('Unified code must be 6-12 digits');
      }
      await this.mcdr.verifyExistingCode(clientId, input.code);
      return tx.investorCode.update({
        where: { clientId },
        data: { code: input.code, status: 'EXISTING_DECLARED', source: 'EXISTING_DECLARED' },
      });
    }
    await this.mcdr.requestCode(clientId);
    return tx.investorCode.update({
      where: { clientId },
      data: { code: null, status: 'REQUESTED', source: 'NEW_REQUEST' },
    });
  }

  /** Broker ops: codes waiting for issue or verification. */
  pendingTasks(tx: Tx) {
    return tx.investorCode.findMany({
      where: { status: { in: ['REQUESTED', 'EXISTING_DECLARED'] } },
      include: { client: { select: { id: true, fullNameEn: true, status: true, nationalIdLast4: true } } },
      orderBy: { updatedAt: 'asc' },
    });
  }

  /** Broker ops: record the verified/issued code and the client's custody accounts. */
  async complete(
    tx: Tx,
    tenantId: string,
    actorId: string,
    clientId: string,
    input: {
      code: string;
      custodyAccounts: { depository: Depository; custodian: string; accountNumber: string }[];
    },
  ) {
    if (!isPlausibleUnifiedCode(input.code)) {
      throw new BadRequestException('Unified code must be 6-12 digits');
    }
    const existing = await tx.investorCode.findUnique({ where: { clientId } });
    if (!existing) throw new NotFoundException('Client not found');
    await tx.investorCode.update({
      where: { clientId },
      data: { code: input.code, status: 'VERIFIED' },
    });
    for (const acc of input.custodyAccounts) {
      await tx.custodyAccount.upsert({
        where: { clientId_depository: { clientId, depository: acc.depository } },
        create: { tenantId, clientId, ...acc },
        update: { custodian: acc.custodian, accountNumber: acc.accountNumber, active: true },
      });
    }
    await this.audit.record(tx, {
      tenantId,
      actorId,
      action: 'UNIFIED_CODE_VERIFIED',
      entity: 'Client',
      entityId: clientId,
      data: { code: input.code, depositories: input.custodyAccounts.map((a) => a.depository) },
    });
  }
}
