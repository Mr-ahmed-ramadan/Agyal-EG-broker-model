import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Tenant } from '@prisma/client';
import { DbService, type Tx } from '../../common/db.service';
import { daysBetween, toUtcDate } from '../../domain/fixed-income';
import { LedgerAccountType } from '../../domain/ledger-rules';
import { statementLines, type StatementEntry } from '../../domain/statement';
import { CashService } from '../cash/cash.service';
import { IncomeService } from '../income/income.service';
import { LedgerService } from '../ledger/ledger.service';

const DAY = 86_400_000;
const CASH_TYPES: string[] = [
  LedgerAccountType.CLIENT_CASH_AVAILABLE,
  LedgerAccountType.CLIENT_CASH_RESERVED,
  LedgerAccountType.CLIENT_CASH_PENDING_WITHDRAWAL,
];
const POSITION_TYPES: string[] = [LedgerAccountType.CLIENT_POSITION, LedgerAccountType.CLIENT_POSITION_RESERVED];
/** Cash at or above this is "ready to invest" on the home page */
const IDLE_CASH = 25_000;

export interface NewsInput {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
}

/**
 * The client's everyday views (home page, statement) and the news shown there.
 * Everything is derived from the ledger, orders and income events.
 */
@Injectable()
export class ExperienceService {
  constructor(
    private readonly db: DbService,
    private readonly ledger: LedgerService,
    private readonly cash: CashService,
    private readonly income: IncomeService,
  ) {}

  // --- Home -----------------------------------------------------------------------------------

  async home(tenant: Tenant, clientId: string) {
    const [cash, income] = await Promise.all([this.cash.summary(tenant, clientId), this.income.forClient(tenant, clientId)]);
    return this.db.forTenant(tenant.id, async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId }, select: { depositReference: true, status: true } });
      const holdings = await this.holdings(tx, tenant.id, clientId);
      const today = toUtcDate(new Date());

      const invested = holdings.reduce((s, h) => s.plus(h.cost), new Decimal(0));
      const allocation = new Map<string, Decimal>();
      for (const h of holdings) allocation.set(h.type, (allocation.get(h.type) ?? new Decimal(0)).plus(h.cost));

      const received = income.received.reduce(
        (s, r) => ({ net: s.net.plus(r.type === 'COUPON' ? r.net : 0), tax: s.tax.plus(r.tax) }),
        { net: new Decimal(0), tax: new Decimal(0) },
      );
      const upcoming = income.upcoming.filter((u) => toUtcDate(new Date(u.paymentDate)) >= today);
      const maturing = holdings.filter((h) => h.daysToMaturity <= 90).sort((a, b) => a.daysToMaturity - b.daysToMaturity);

      // Highlights: structured so the app can word them in the client's language.
      const highlights: Record<string, unknown>[] = [];
      if (holdings.length === 0 && new Decimal(cash.available).lt(1)) {
        highlights.push({ kind: 'FUND_ACCOUNT', reference: client?.depositReference });
      }
      if (upcoming[0]) highlights.push({ kind: 'NEXT_PAYMENT', ...upcoming[0] });
      for (const m of maturing.slice(0, 2)) highlights.push({ kind: 'MATURING', isin: m.isin, days: m.daysToMaturity, nominal: m.nominal });
      if (new Decimal(cash.available).gte(IDLE_CASH)) highlights.push({ kind: 'IDLE_CASH', amount: cash.available });

      return {
        clientStatus: client?.status,
        depositReference: client?.depositReference,
        cash,
        totals: {
          invested: invested.toFixed(2),
          faceValue: holdings.reduce((s, h) => s.plus(h.nominal), new Decimal(0)).toFixed(2),
          incomeReceivedNet: received.net.toFixed(2),
          taxWithheld: received.tax.toFixed(2),
        },
        holdings: holdings.map((h) => ({ ...h, nominal: h.nominal.toFixed(2), cost: h.cost.toFixed(2) })),
        allocation: [...allocation].map(([type, cost]) => ({
          type,
          cost: cost.toFixed(2),
          share: invested.isZero() ? '0' : cost.div(invested).toDecimalPlaces(4).toString(),
        })),
        upcoming: upcoming.slice(0, 5),
        maturingSoon: maturing.map((h) => ({ isin: h.isin, maturityDate: h.maturityDate, days: h.daysToMaturity, nominal: h.nominal.toFixed(2) })),
        highlights,
        news: await this.latestNews(tx, 5),
      };
    });
  }

  /** Client holdings with cost (average buy price) and time to maturity. */
  private async holdings(tx: Tx, tenantId: string, clientId: string) {
    const portfolio = await this.ledger.clientPortfolio(tx, tenantId, clientId);
    if (portfolio.positions.length === 0) return [];
    const isins = portfolio.positions.map((p) => p.isin);
    const instruments = new Map((await tx.instrument.findMany({ where: { isin: { in: isins } } })).map((i) => [i.isin, i]));
    const buys = await tx.order.findMany({
      where: { clientId, isin: { in: isins }, side: 'BUY', cumQty: { gt: 0 } },
      include: { priceSnapshot: true },
    });
    const today = new Date();
    return portfolio.positions.flatMap((p) => {
      const i = instruments.get(p.isin);
      if (!i) return [];
      const mine = buys.filter((o) => o.isin === p.isin);
      const qty = mine.reduce((s, o) => s.plus(o.cumQty.toString()), new Decimal(0));
      const avgPx = qty.isZero()
        ? new Decimal(100)
        : mine.reduce((s, o) => s.plus(new Decimal(o.cumQty.toString()).mul(o.priceSnapshot.clientCleanPx.toString())), new Decimal(0)).div(qty);
      const nominal = new Decimal(p.nominal);
      return [{
        isin: i.isin,
        nameEn: i.nameEn,
        nameAr: i.nameAr,
        type: i.type as string,
        couponRate: i.couponRate?.toString() ?? null,
        maturityDate: i.maturityDate,
        daysToMaturity: Math.max(0, daysBetween(today, i.maturityDate)),
        nominal,
        avgPrice: avgPx.toDecimalPlaces(4).toString(),
        cost: nominal.mul(avgPx).div(100).toDecimalPlaces(2),
      }];
    });
  }

  // --- Statement ------------------------------------------------------------------------------

  async statement(tenant: Tenant, clientId: string, fromStr?: string, toStr?: string) {
    const today = toUtcDate(new Date());
    const from = fromStr ? new Date(`${fromStr}T00:00:00Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const to = toStr ? new Date(`${toStr}T00:00:00Z`) : today;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new BadRequestException('Invalid period');
    const end = new Date(to.getTime() + DAY); // inclusive of the last day

    return this.db.forTenant(tenant.id, async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId }, include: { investorCode: true } });
      const postings = await tx.posting.findMany({
        where: { account: { clientId }, journalEntry: { createdAt: { lt: end } } },
        include: { account: true, journalEntry: true },
      });

      let opening = new Decimal(0);
      const entries = new Map<string, StatementEntry>();
      const positionsAtEnd = new Map<string, Decimal>();
      for (const p of postings) {
        const amount = new Decimal(p.amount.toString()).neg(); // client accounts are credit-normal
        const isCash = CASH_TYPES.includes(p.account.type);
        const isPosition = POSITION_TYPES.includes(p.account.type);
        if (isPosition) positionsAtEnd.set(p.account.unit, (positionsAtEnd.get(p.account.unit) ?? new Decimal(0)).plus(amount));
        if (p.journalEntry.createdAt < from) {
          if (isCash) opening = opening.plus(amount);
          continue;
        }
        const e = entries.get(p.journalEntryId) ?? {
          journalEntryId: p.journalEntryId,
          eventType: p.journalEntry.eventType,
          reference: p.journalEntry.reference,
          date: p.journalEntry.createdAt,
          cash: new Decimal(0),
          positions: new Map<string, Decimal>(),
        };
        if (isCash) e.cash = e.cash.plus(amount);
        if (isPosition) e.positions.set(p.account.unit, (e.positions.get(p.account.unit) ?? new Decimal(0)).plus(amount));
        entries.set(p.journalEntryId, e);
      }

      const { lines, closing, totals } = statementLines(opening, [...entries.values()]);
      const details = await this.lineDetails(tx, clientId, lines.map((l) => ({ kind: l.kind, reference: l.reference })));
      const isins = [...new Set([...lines.map((l) => l.isin).filter((x): x is string => !!x), ...positionsAtEnd.keys()])];
      const instruments = await tx.instrument.findMany({ where: { isin: { in: isins } } });
      const commissions = details.reduce((s, d) => s.plus(d.commission ?? 0), new Decimal(0));
      const tax = details.reduce((s, d) => s.plus(d.tax ?? 0), new Decimal(0));

      return {
        client: {
          name: client?.fullNameEn ?? '',
          nameAr: client?.fullNameAr ?? '',
          unifiedCode: client?.investorCode?.code ?? null,
          depositReference: client?.depositReference,
        },
        broker: { nameEn: tenant.legalNameEn, nameAr: tenant.legalNameAr, fraLicenseNo: tenant.fraLicenseNo },
        period: { from, to },
        currency: 'EGP',
        openingBalance: opening.toFixed(2),
        closingBalance: closing.toFixed(2),
        totals: { ...totals, commissions: commissions.toFixed(2), taxWithheld: tax.toFixed(2) },
        lines: lines.map((l, k) => ({ ...l, ...details[k] })),
        holdings: [...positionsAtEnd]
          .filter(([, n]) => n.gt(0))
          .map(([isin, n]) => {
            const i = instruments.find((x) => x.isin === isin);
            return { isin, nameEn: i?.nameEn ?? isin, nameAr: i?.nameAr ?? isin, type: i?.type ?? null, maturityDate: i?.maturityDate ?? null, nominal: n.toFixed(2) };
          }),
        instruments: Object.fromEntries(instruments.map((i) => [i.isin, { nameEn: i.nameEn, nameAr: i.nameAr, type: i.type }])),
      };
    });
  }

  /** Price and commission for trades; gross and tax for income. */
  private async lineDetails(tx: Tx, clientId: string, lines: { kind: string; reference: string }[]) {
    return Promise.all(
      lines.map(async (l): Promise<{ price?: string; commission?: string; gross?: string; tax?: string }> => {
        if (l.kind === 'BUY' || l.kind === 'SELL') {
          const [bankId, ...rest] = l.reference.split(':');
          const exec = await tx.execution.findUnique({
            where: { bankId_execId: { bankId, execId: rest.join(':') } },
            include: { order: { include: { priceSnapshot: true } } },
          });
          if (!exec) return {};
          const snap = exec.order.priceSnapshot;
          const share = exec.lastQty ? new Decimal(exec.lastQty.toString()).div(exec.order.orderQty.toString()) : new Decimal(1);
          return { price: snap.clientCleanPx.toString(), commission: new Decimal(snap.commission.toString()).mul(share).toFixed(2) };
        }
        if (l.kind === 'COUPON' || l.kind === 'REDEMPTION') {
          const [isin, type, date] = l.reference.split(':');
          const ent = await tx.incomeEntitlement.findFirst({
            where: { clientId, event: { isin, type, paymentDate: new Date(`${date}T00:00:00Z`) } },
          });
          return ent ? { gross: ent.gross.toFixed(2), tax: ent.tax.toFixed(2) } : {};
        }
        return {};
      }),
    );
  }

  // --- News -----------------------------------------------------------------------------------

  private latestNews(tx: Tx, take: number) {
    return tx.announcement.findMany({ orderBy: { publishedAt: 'desc' }, take });
  }

  /** Broker: their own announcements plus platform ones (read only). */
  brokerNews(tenant: Tenant) {
    return this.db.forTenant(tenant.id, (tx) => this.latestNews(tx, 50));
  }

  postBrokerNews(tenant: Tenant, actorId: string, input: NewsInput) {
    return this.db.forTenant(tenant.id, (tx) => tx.announcement.create({ data: { ...input, tenantId: tenant.id, createdById: actorId } }));
  }

  platformNews() {
    return this.db.asSystem((tx) => tx.announcement.findMany({ where: { tenantId: null }, orderBy: { publishedAt: 'desc' }, take: 50 }));
  }

  postPlatformNews(actorId: string, input: NewsInput) {
    return this.db.asSystem((tx) => tx.announcement.create({ data: { ...input, tenantId: null, createdById: actorId } }));
  }

  async deleteNews(tenant: Tenant | null, id: string) {
    const run = (tx: Tx) => tx.announcement.deleteMany({ where: { id, tenantId: tenant ? tenant.id : null } });
    const res = tenant ? await this.db.forTenant(tenant.id, run) : await this.db.asSystem(run);
    return { deleted: res.count };
  }
}
