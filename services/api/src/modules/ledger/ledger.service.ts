import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Tx } from '../../common/db.service';
import {
  accountKey,
  displayBalance,
  LedgerAccountType,
  validateEntry,
  type AccountRef,
  type PostingLine,
} from '../../domain/ledger-rules';

/** Per-tenant double-entry ledger (ADR 0007). Always called inside DbService.forTenant(). */
@Injectable()
export class LedgerService {
  /**
   * Posts a balanced journal entry. Idempotent on (eventType, reference): posting
   * the same business event twice returns the original entry.
   */
  async post(
    tx: Tx,
    tenantId: string,
    eventType: string,
    reference: string,
    lines: PostingLine[],
    createdById?: string,
  ) {
    const existing = await tx.journalEntry.findUnique({
      where: { tenantId_eventType_reference: { tenantId, eventType, reference } },
    });
    if (existing) return existing;

    const valid = validateEntry(lines);
    const entry = await tx.journalEntry.create({
      data: { tenantId, eventType, reference, createdById },
    });
    for (const line of valid) {
      const account = await this.account(tx, tenantId, line.account);
      await tx.posting.create({
        data: {
          tenantId,
          journalEntryId: entry.id,
          accountId: account.id,
          amount: line.amount.toFixed(2),
        },
      });
    }
    return entry;
  }

  async balance(tx: Tx, tenantId: string, ref: AccountRef): Promise<Decimal> {
    const account = await tx.ledgerAccount.findUnique({ where: { key: accountKey(tenantId, ref) } });
    if (!account) return new Decimal(0);
    const agg = await tx.posting.aggregate({ where: { accountId: account.id }, _sum: { amount: true } });
    return displayBalance(ref.type, agg._sum.amount?.toString() ?? 0);
  }

  async clientPortfolio(tx: Tx, tenantId: string, clientId: string) {
    const accounts = await tx.ledgerAccount.findMany({ where: { clientId } });
    const cash = { available: new Decimal(0), reserved: new Decimal(0) };
    const positions = new Map<string, { free: Decimal; reserved: Decimal }>();
    const pos = (isin: string) => {
      if (!positions.has(isin)) positions.set(isin, { free: new Decimal(0), reserved: new Decimal(0) });
      return positions.get(isin)!;
    };
    for (const a of accounts) {
      const agg = await tx.posting.aggregate({ where: { accountId: a.id }, _sum: { amount: true } });
      const bal = displayBalance(a.type as LedgerAccountType, agg._sum.amount?.toString() ?? 0);
      if (a.type === LedgerAccountType.CLIENT_CASH_AVAILABLE) cash.available = bal;
      else if (a.type === LedgerAccountType.CLIENT_CASH_RESERVED) cash.reserved = bal;
      else if (a.type === LedgerAccountType.CLIENT_POSITION) pos(a.unit).free = bal;
      else if (a.type === LedgerAccountType.CLIENT_POSITION_RESERVED) pos(a.unit).reserved = bal;
    }
    return {
      currency: 'EGP',
      cash: { available: cash.available.toFixed(2), reserved: cash.reserved.toFixed(2) },
      positions: [...positions]
        .filter(([, p]) => !p.free.plus(p.reserved).isZero())
        .map(([isin, p]) => ({
          isin,
          /** Total held; `reservedForSale` of it is committed to open sell orders */
          nominal: p.free.plus(p.reserved).toFixed(2),
          reservedForSale: p.reserved.toFixed(2),
        })),
    };
  }

  /** Raw signed sums per account; debits and credits must net to zero per unit. */
  async trialBalance(tx: Tx) {
    const accounts = await tx.ledgerAccount.findMany({ orderBy: [{ type: 'asc' }, { unit: 'asc' }] });
    const rows = [];
    for (const a of accounts) {
      const agg = await tx.posting.aggregate({ where: { accountId: a.id }, _sum: { amount: true } });
      rows.push({
        type: a.type,
        unit: a.unit,
        clientId: a.clientId,
        bankId: a.bankId,
        rawSum: new Decimal(agg._sum.amount?.toString() ?? 0).toFixed(2),
      });
    }
    return rows;
  }

  private async account(tx: Tx, tenantId: string, ref: AccountRef) {
    const key = accountKey(tenantId, ref);
    return tx.ledgerAccount.upsert({
      where: { key },
      create: {
        tenantId,
        key,
        type: ref.type,
        unit: ref.unit,
        clientId: ref.clientId ?? null,
        bankId: ref.bankId ?? null,
      },
      update: {},
    });
  }
}
