import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Instrument, Tenant } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import { DbService, type Tx } from '../../common/db.service';
import { tenantConfig } from '../../common/tenant-config';
import { toUtcDate } from '../../domain/fixed-income';
import {
  entitlementAmount,
  eventKey,
  incomeSchedule,
  withholding,
  type IncomeType,
  type ScheduledPayment,
} from '../../domain/income';
import { incomeReceivedEntry, LedgerAccountType } from '../../domain/ledger-rules';
import { LedgerService } from '../ledger/ledger.service';

const DAY = 86_400_000;
/** How far back unconfirmed payments stay listed, and how far ahead upcoming ones are shown */
const LOOKBACK_DAYS = 120;
const LOOKAHEAD_DAYS = 60;

/** Hosted demo only: lets ops confirm a payment before its date so the flow can be tested. */
function demoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

interface Holding {
  clientId: string;
  nominal: Decimal;
  reserved: Decimal;
}

interface ProjectedEvent extends ScheduledPayment {
  instrument: Instrument;
  key: string;
  holdings: Holding[];
}

/**
 * Coupons and redemptions (ADR 0007). Payments are projected from each
 * instrument's schedule and the clients' holdings on the payment date; broker
 * ops confirm receipt from the custodian/CBE, which credits clients (net of
 * any withholding tax) and, at maturity, closes their positions.
 */
@Injectable()
export class IncomeService {
  constructor(
    private readonly db: DbService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /** Broker ops: payments not yet confirmed, due or upcoming. */
  async pending(tenant: Tenant) {
    const rate = tenantConfig(tenant.config).couponWithholdingRate;
    return this.db.forTenant(tenant.id, async (tx) => {
      const events = await this.projected(tx);
      const today = toUtcDate(new Date());
      return events.map((e) => {
        const gross = e.holdings.reduce((s, h) => s.plus(entitlementAmount(h.nominal, e.per100)), new Decimal(0));
        return {
          key: e.key,
          isin: e.instrument.isin,
          name: e.instrument.nameEn,
          type: e.type,
          paymentDate: e.paymentDate,
          per100: e.per100.toFixed(6),
          holders: e.holdings.length,
          totalNominal: e.holdings.reduce((s, h) => s.plus(h.nominal), new Decimal(0)).toFixed(2),
          totalGross: gross.toFixed(2),
          totalTax: e.type === 'COUPON' ? withholding(gross, rate).toFixed(2) : '0.00',
          due: e.paymentDate <= today,
          canConfirm: e.paymentDate <= today || demoMode(),
        };
      });
    });
  }

  /** Broker ops: confirm the issuer's payment was received; credits clients. Idempotent. */
  async confirm(tenant: Tenant, actorId: string, input: { isin: string; type: IncomeType; paymentDate: string; reference: string }) {
    const paymentDate = new Date(`${input.paymentDate}T00:00:00Z`);
    const rate = tenantConfig(tenant.config).couponWithholdingRate;
    return this.db.forTenant(tenant.id, async (tx) => {
      const existing = await tx.incomeEvent.findUnique({
        where: { tenantId_isin_type_paymentDate: { tenantId: tenant.id, isin: input.isin, type: input.type, paymentDate } },
      });
      if (existing) return { eventId: existing.id, alreadyConfirmed: true };

      const events = await this.projected(tx);
      const event = events.find((e) => e.key === eventKey(input.isin, input.type, paymentDate));
      if (!event) throw new NotFoundException('No holders are entitled to this payment');
      if (paymentDate > toUtcDate(new Date()) && !demoMode()) {
        throw new ConflictException('This payment is not due yet');
      }
      if (event.type === 'REDEMPTION') {
        if (event.holdings.some((h) => h.reserved.gt(0))) {
          throw new ConflictException('Clients have open sell orders in this instrument; resolve them first');
        }
        const finalCoupon = events.find((e) => e.key === eventKey(input.isin, 'COUPON', paymentDate));
        if (finalCoupon) throw new ConflictException('Confirm the final coupon before the redemption');
      }

      const lines = event.holdings.map((h) => {
        const gross = entitlementAmount(h.nominal, event.per100);
        const tax = event.type === 'COUPON' ? withholding(gross, rate) : new Decimal(0);
        return { clientId: h.clientId, nominal: h.nominal, gross, tax };
      });
      const totalGross = lines.reduce((s, l) => s.plus(l.gross), new Decimal(0));
      const totalTax = lines.reduce((s, l) => s.plus(l.tax), new Decimal(0));

      const saved = await tx.incomeEvent.create({
        data: {
          tenantId: tenant.id,
          isin: input.isin,
          type: input.type,
          paymentDate,
          per100: event.per100.toFixed(8),
          totalGross: totalGross.toFixed(2),
          totalTax: totalTax.toFixed(2),
          reference: input.reference,
          confirmedById: actorId,
          entitlements: {
            create: lines.map((l) => ({
              tenantId: tenant.id,
              clientId: l.clientId,
              nominal: l.nominal.toFixed(2),
              gross: l.gross.toFixed(2),
              tax: l.tax.toFixed(2),
              net: l.gross.minus(l.tax).toFixed(2),
            })),
          },
        },
      });
      await this.ledger.post(
        tx,
        tenant.id,
        event.type === 'COUPON' ? 'COUPON_RECEIVED' : 'REDEMPTION_RECEIVED',
        event.key,
        incomeReceivedEntry(input.isin, lines, event.type === 'REDEMPTION'),
        actorId,
      );
      await this.audit.record(tx, {
        tenantId: tenant.id,
        actorId,
        action: `${event.type}_CONFIRMED`,
        entity: 'IncomeEvent',
        entityId: saved.id,
        data: { key: event.key, reference: input.reference, totalGross: totalGross.toFixed(2), holders: lines.length },
      });
      return { eventId: saved.id, holders: lines.length, totalGross: totalGross.toFixed(2), totalTax: totalTax.toFixed(2) };
    });
  }

  /** Broker: confirmed payments. */
  history(tenant: Tenant) {
    return this.db.forTenant(tenant.id, (tx) =>
      tx.incomeEvent.findMany({ orderBy: { paymentDate: 'desc' }, take: 100, include: { _count: { select: { entitlements: true } } } }),
    );
  }

  /** Client: upcoming payments on their holdings and income received. */
  async forClient(tenant: Tenant, clientId: string) {
    const rate = tenantConfig(tenant.config).couponWithholdingRate;
    return this.db.forTenant(tenant.id, async (tx) => {
      const events = await this.projected(tx);
      const upcoming = events.flatMap((e) => {
        const h = e.holdings.find((x) => x.clientId === clientId);
        if (!h) return [];
        const gross = entitlementAmount(h.nominal, e.per100);
        const tax = e.type === 'COUPON' ? withholding(gross, rate) : new Decimal(0);
        return [{ isin: e.instrument.isin, type: e.type, paymentDate: e.paymentDate, nominal: h.nominal.toFixed(2), expectedNet: gross.minus(tax).toFixed(2) }];
      });
      const received = await tx.incomeEntitlement.findMany({
        where: { clientId },
        include: { event: true },
        orderBy: { event: { paymentDate: 'desc' } },
      });
      return {
        upcoming,
        received: received.map((r) => ({
          isin: r.event.isin,
          type: r.event.type,
          paymentDate: r.event.paymentDate,
          nominal: r.nominal.toFixed(2),
          gross: r.gross.toFixed(2),
          tax: r.tax.toFixed(2),
          net: r.net.toFixed(2),
        })),
      };
    });
  }

  // --- projection -----------------------------------------------------------------------------

  /** Unconfirmed scheduled payments in the window with at least one entitled holder. */
  private async projected(tx: Tx): Promise<ProjectedEvent[]> {
    const custody = await tx.ledgerAccount.findMany({
      where: { type: LedgerAccountType.CUSTODY_POSITION },
      select: { unit: true },
    });
    const isins = [...new Set(custody.map((c) => c.unit))];
    if (isins.length === 0) return [];
    const instruments = await tx.instrument.findMany({ where: { isin: { in: isins } } });
    const confirmed = new Set(
      (await tx.incomeEvent.findMany({ where: { isin: { in: isins } } })).map((e) => eventKey(e.isin, e.type as IncomeType, e.paymentDate)),
    );

    const now = Date.now();
    const from = new Date(now - LOOKBACK_DAYS * DAY);
    const to = new Date(now + LOOKAHEAD_DAYS * DAY);
    const out: ProjectedEvent[] = [];
    for (const instrument of instruments) {
      const schedule = incomeSchedule(
        {
          type: instrument.type,
          couponRate: instrument.couponRate == null ? null : Number(instrument.couponRate),
          couponFreq: instrument.couponFreq,
          maturityDate: instrument.maturityDate,
        },
        from,
        to,
      );
      for (const p of schedule) {
        const key = eventKey(instrument.isin, p.type, p.paymentDate);
        if (confirmed.has(key)) continue;
        const holdings = await this.holdingsAsOf(tx, instrument.isin, p.paymentDate);
        if (holdings.length) out.push({ ...p, instrument, key, holdings });
      }
    }
    return out.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());
  }

  /**
   * Each client's holding at the end of the payment date (free + reserved for
   * sale), from ledger postings made up to then. Excludes income postings so a
   * redemption confirmed on the same day doesn't hide the final coupon.
   */
  private async holdingsAsOf(tx: Tx, isin: string, paymentDate: Date): Promise<Holding[]> {
    const cutoff = new Date(toUtcDate(paymentDate).getTime() + DAY);
    const rows = await tx.$queryRaw<{ clientId: string; type: string; total: string }[]>`
      SELECT a."clientId", a.type, SUM(p.amount)::text AS total
      FROM "Posting" p
      JOIN "LedgerAccount" a ON a.id = p."accountId"
      JOIN "JournalEntry" j ON j.id = p."journalEntryId"
      WHERE a.unit = ${isin}
        AND a.type IN ('CLIENT_POSITION', 'CLIENT_POSITION_RESERVED')
        AND j."createdAt" < ${cutoff}
        AND j."eventType" NOT IN ('COUPON_RECEIVED', 'REDEMPTION_RECEIVED')
      GROUP BY a."clientId", a.type`;
    const byClient = new Map<string, Holding>();
    for (const r of rows) {
      const h = byClient.get(r.clientId) ?? { clientId: r.clientId, nominal: new Decimal(0), reserved: new Decimal(0) };
      const bal = new Decimal(r.total).neg(); // position accounts are credit-normal
      h.nominal = h.nominal.plus(bal);
      if (r.type === 'CLIENT_POSITION_RESERVED') h.reserved = h.reserved.plus(bal);
      byClient.set(r.clientId, h);
    }
    // Clients whose redemption is already confirmed have no position left for this ISIN.
    return [...byClient.values()].filter((h) => h.nominal.gt(0));
  }
}
