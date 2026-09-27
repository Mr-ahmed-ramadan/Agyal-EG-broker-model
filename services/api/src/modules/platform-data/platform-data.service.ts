import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DbService, type Tx } from '../../common/db.service';

/** Tables the data console can browse (read only), with the Prisma delegate and default order. */
export const TABLES: Record<string, { delegate: string; orderBy: Record<string, 'asc' | 'desc'>; label: string }> = {
  Tenant: { delegate: 'tenant', orderBy: { createdAt: 'desc' }, label: 'Brokers' },
  User: { delegate: 'user', orderBy: { createdAt: 'desc' }, label: 'Users' },
  Client: { delegate: 'client', orderBy: { createdAt: 'desc' }, label: 'Clients' },
  OnboardingApplication: { delegate: 'onboardingApplication', orderBy: { updatedAt: 'desc' }, label: 'Onboarding applications' },
  Consent: { delegate: 'consent', orderBy: { acceptedAt: 'desc' }, label: 'Consents' },
  InvestorCode: { delegate: 'investorCode', orderBy: { id: 'desc' }, label: 'Unified codes' },
  CustodyAccount: { delegate: 'custodyAccount', orderBy: { id: 'desc' }, label: 'Custody accounts' },
  ComplianceFlag: { delegate: 'complianceFlag', orderBy: { raisedAt: 'desc' }, label: 'Compliance flags' },
  Instrument: { delegate: 'instrument', orderBy: { maturityDate: 'asc' }, label: 'Instruments' },
  IndicativeRate: { delegate: 'indicativeRate', orderBy: { asOf: 'desc' }, label: 'Indicative rates' },
  Bank: { delegate: 'bank', orderBy: { code: 'asc' }, label: 'Banks' },
  BrokerBankRelationship: { delegate: 'brokerBankRelationship', orderBy: { id: 'desc' }, label: 'Broker–bank links' },
  QuoteRequest: { delegate: 'quoteRequest', orderBy: { createdAt: 'desc' }, label: 'Price requests (RFQ)' },
  Quote: { delegate: 'quote', orderBy: { receivedAt: 'desc' }, label: 'Bank quotes' },
  Order: { delegate: 'order', orderBy: { createdAt: 'desc' }, label: 'Orders' },
  Execution: { delegate: 'execution', orderBy: { createdAt: 'desc' }, label: 'Executions' },
  PriceSnapshot: { delegate: 'priceSnapshot', orderBy: { createdAt: 'desc' }, label: 'Price snapshots' },
  JournalEntry: { delegate: 'journalEntry', orderBy: { createdAt: 'desc' }, label: 'Journal entries' },
  Posting: { delegate: 'posting', orderBy: { id: 'desc' }, label: 'Postings' },
  LedgerAccount: { delegate: 'ledgerAccount', orderBy: { key: 'asc' }, label: 'Ledger accounts' },
  ClientBankAccount: { delegate: 'clientBankAccount', orderBy: { createdAt: 'desc' }, label: 'Client bank accounts' },
  Withdrawal: { delegate: 'withdrawal', orderBy: { requestedAt: 'desc' }, label: 'Withdrawals' },
  IncomeEvent: { delegate: 'incomeEvent', orderBy: { paymentDate: 'desc' }, label: 'Coupons & redemptions' },
  IncomeEntitlement: { delegate: 'incomeEntitlement', orderBy: { id: 'desc' }, label: 'Income per client' },
  Lead: { delegate: 'lead', orderBy: { createdAt: 'desc' }, label: 'Leads' },
  Announcement: { delegate: 'announcement', orderBy: { publishedAt: 'desc' }, label: 'News' },
  PlatformSetting: { delegate: 'platformSetting', orderBy: { key: 'asc' }, label: 'Platform settings' },
  FixMessage: { delegate: 'fixMessage', orderBy: { id: 'desc' }, label: 'FIX messages' },
  FixOutbox: { delegate: 'fixOutbox', orderBy: { id: 'desc' }, label: 'FIX outbox' },
  FixInbox: { delegate: 'fixInbox', orderBy: { id: 'desc' }, label: 'FIX inbox' },
  AuditLog: { delegate: 'auditLog', orderBy: { createdAt: 'desc' }, label: 'Audit log' },
  DataChange: { delegate: 'dataChange', orderBy: { id: 'desc' }, label: 'Data changes' },
};

const SECRET_FIELDS = new Set(['passwordHash', 'codeHash', 'nationalIdEncrypted']);

/** Makes a row safe and JSON-serialisable: secrets masked, logos shortened, BigInt/Decimal as strings. */
export function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (SECRET_FIELDS.has(k)) out[k] = v == null ? null : '[redacted]';
    else if (typeof v === 'bigint') out[k] = v.toString();
    else if (k === 'branding' && v && typeof v === 'object') {
      const b = { ...(v as Record<string, unknown>) };
      if (typeof b.logoUrl === 'string' && b.logoUrl.length > 80) b.logoUrl = `${b.logoUrl.slice(0, 40)}… (${b.logoUrl.length} chars)`;
      out[k] = b;
    } else if (v && typeof v === 'object' && 'toFixed' in (v as object) && typeof (v as { toFixed: unknown }).toFixed === 'function' && !(v instanceof Date)) {
      out[k] = String(v);
    } else out[k] = v;
  }
  return out;
}

export interface TimelineItem {
  at: Date;
  kind: 'ACTION' | 'DATA' | 'LEDGER' | 'FIX' | 'SIGN_IN';
  title: string;
  detail?: unknown;
  actor?: string | null;
  ref?: string | null;
}

@Injectable()
export class PlatformDataService {
  constructor(private readonly db: DbService) {}

  // --- Tables -------------------------------------------------------------------------------

  tables() {
    return this.db.asSystem(async (tx) => {
      const out = [];
      for (const [name, t] of Object.entries(TABLES)) {
        const count = await (tx as unknown as Record<string, { count: () => Promise<number> }>)[t.delegate].count();
        out.push({ name, label: t.label, count });
      }
      return out;
    });
  }

  rows(table: string, skip: number, take: number, field?: string, value?: string) {
    const t = TABLES[table];
    if (!t) throw new NotFoundException('Unknown table');
    return this.db.asSystem(async (tx) => {
      const delegate = (tx as unknown as Record<string, { findMany: (a: unknown) => Promise<Record<string, unknown>[]>; count: (a: unknown) => Promise<number> }>)[t.delegate];
      const where = field && value ? { [field]: SECRET_FIELDS.has(field) ? '__never__' : value } : {};
      let rows: Record<string, unknown>[];
      let total: number;
      try {
        [rows, total] = await Promise.all([delegate.findMany({ where, orderBy: t.orderBy, skip, take }), delegate.count({ where })]);
      } catch {
        throw new BadRequestException(`Can't filter ${table} by ${field} = ${value}`);
      }
      return { table, total, skip, take, rows: rows.map(redactRow) };
    });
  }

  // --- Search -------------------------------------------------------------------------------

  search(q: string) {
    const term = q.trim();
    if (term.length < 2) throw new BadRequestException('Type at least 2 characters');
    return this.db.asSystem(async (tx) => {
      const tenants = await tx.tenant.findMany({
        where: { OR: [{ slug: { contains: term, mode: 'insensitive' } }, { legalNameEn: { contains: term, mode: 'insensitive' } }, { legalNameAr: { contains: term } }] },
        take: 10,
      });
      const users = await tx.user.findMany({ where: { email: { contains: term, mode: 'insensitive' } }, take: 20 });
      const clients = await tx.client.findMany({
        where: {
          OR: [
            { fullNameEn: { contains: term, mode: 'insensitive' } },
            { fullNameAr: { contains: term } },
            { depositReference: { contains: term.toUpperCase() } },
            { userId: { in: users.map((u) => u.id) } },
            { id: term },
          ],
        },
        take: 20,
      });
      const orders = await tx.order.findMany({ where: { OR: [{ id: term }, { clOrdId: term }, { orderId: term }] }, take: 10 });
      const instruments = await tx.instrument.findMany({ where: { OR: [{ isin: { contains: term.toUpperCase() } }, { nameEn: { contains: term, mode: 'insensitive' } }] }, take: 10 });
      const tenantName = new Map((await tx.tenant.findMany({ select: { id: true, legalNameEn: true } })).map((t) => [t.id, t.legalNameEn]));
      return [
        ...tenants.map((t) => ({ kind: 'tenant', id: t.id, title: t.legalNameEn, subtitle: `Broker · ${t.slug}` })),
        ...clients.map((c) => ({ kind: 'client', id: c.id, title: c.fullNameEn ?? c.depositReference, subtitle: `Client · ${tenantName.get(c.tenantId) ?? ''} · ${c.status} · ref ${c.depositReference}` })),
        ...users
          .filter((u) => !clients.some((c) => c.userId === u.id))
          .map((u) => ({ kind: 'user', id: u.id, title: u.email, subtitle: `User · ${u.roles.join(', ')}${u.tenantId ? ` · ${tenantName.get(u.tenantId) ?? ''}` : ' · Agyal'}` })),
        ...orders.map((o) => ({ kind: 'order', id: o.id, title: `${o.side === '1' ? 'Buy' : 'Sell'} ${o.isin} ${o.orderQty.toFixed(0)}`, subtitle: `Order · ${o.clOrdId} · status ${o.ordStatus}` })),
        ...instruments.map((i) => ({ kind: 'instrument', id: i.isin, title: i.nameEn, subtitle: `Instrument · ${i.isin}` })),
      ];
    });
  }

  // --- 360° ---------------------------------------------------------------------------------

  async view360(kind: string, id: string) {
    return this.db.asSystem(async (tx) => {
      switch (kind) {
        case 'client':
          return this.client360(tx, id);
        case 'tenant':
          return this.tenant360(tx, id);
        case 'order':
          return this.order360(tx, id);
        case 'user':
          return this.user360(tx, id);
        case 'instrument':
          return this.instrument360(tx, id);
        default:
          throw new BadRequestException('Unknown kind');
      }
    });
  }

  private async client360(tx: Tx, id: string) {
    const c = await tx.client.findUnique({
      where: { id },
      include: { onboarding: true, investorCode: true, custodyAccounts: true, consents: true, bankAccounts: true, withdrawals: true, incomes: true },
    });
    if (!c) throw new NotFoundException('Client not found');
    const [user, tenant, orders, flags, accounts] = await Promise.all([
      tx.user.findUnique({ where: { id: c.userId } }),
      tx.tenant.findUnique({ where: { id: c.tenantId }, select: { id: true, slug: true, legalNameEn: true } }),
      tx.order.findMany({ where: { clientId: id }, include: { executions: true, priceSnapshot: true }, orderBy: { createdAt: 'desc' } }),
      tx.complianceFlag.findMany({ where: { clientId: id } }),
      tx.ledgerAccount.findMany({ where: { clientId: id } }),
    ]);
    const balances = await Promise.all(
      accounts.map(async (a) => {
        const agg = await tx.posting.aggregate({ where: { accountId: a.id }, _sum: { amount: true } });
        return { type: a.type, unit: a.unit, balance: (agg._sum.amount?.neg() ?? 0).toString() };
      }),
    );
    const entries = await tx.journalEntry.findMany({
      where: { postings: { some: { accountId: { in: accounts.map((a) => a.id) } } } },
      include: { postings: { where: { accountId: { in: accounts.map((a) => a.id) } }, include: { account: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const rowIds = [id, c.userId, c.onboarding?.id, c.investorCode?.id, ...c.custodyAccounts.map((x) => x.id), ...c.consents.map((x) => x.id), ...c.bankAccounts.map((x) => x.id), ...c.withdrawals.map((x) => x.id), ...orders.map((o) => o.id), ...flags.map((f) => f.id)].filter(Boolean) as string[];
    const timeline = await this.timeline(tx, {
      rowIds,
      actorIds: [c.userId],
      entityIds: [id, c.userId, ...orders.map((o) => o.id), ...c.withdrawals.map((w) => w.id)],
      entries,
      clOrdIds: orders.map((o) => o.clOrdId),
    });
    return {
      kind: 'client',
      title: c.fullNameEn ?? c.depositReference,
      summary: redactRow({ ...c, onboarding: undefined, investorCode: undefined, custodyAccounts: undefined, consents: undefined, bankAccounts: undefined, withdrawals: undefined, incomes: undefined, email: user?.email, mobile: user?.mobile, broker: tenant?.legalNameEn }),
      sections: {
        onboarding: c.onboarding ? [redactRow(c.onboarding as unknown as Record<string, unknown>)] : [],
        unifiedCode: c.investorCode ? [redactRow(c.investorCode as unknown as Record<string, unknown>)] : [],
        custodyAccounts: c.custodyAccounts.map((x) => redactRow(x as unknown as Record<string, unknown>)),
        consents: c.consents.map((x) => redactRow(x as unknown as Record<string, unknown>)),
        balances,
        orders: orders.map((o) => redactRow({ id: o.id, createdAt: o.createdAt, side: o.side === '1' ? 'BUY' : 'SELL', isin: o.isin, qty: o.orderQty, status: o.ordStatus, clientTotal: o.priceSnapshot.netAmount, clientYield: o.priceSnapshot.clientYield, settledAt: o.settledAt, executions: o.executions.length })),
        withdrawals: c.withdrawals.map((x) => redactRow(x as unknown as Record<string, unknown>)),
        income: c.incomes.map((x) => redactRow(x as unknown as Record<string, unknown>)),
        bankAccounts: c.bankAccounts.map((x) => redactRow(x as unknown as Record<string, unknown>)),
        flags: flags.map((x) => redactRow(x as unknown as Record<string, unknown>)),
      },
      links: { broker: tenant ? { kind: 'tenant', id: tenant.id, title: tenant.legalNameEn } : null, user: user ? { kind: 'user', id: user.id, title: user.email } : null },
      timeline,
    };
  }

  private async tenant360(tx: Tx, id: string) {
    const t = await tx.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Broker not found');
    const [users, clientsByStatus, orders, relations, flags] = await Promise.all([
      tx.user.findMany({ where: { tenantId: id, roles: { hasSome: ['BROKER_ADMIN', 'BROKER_COMPLIANCE', 'BROKER_DEALER', 'BROKER_OPS', 'BROKER_FINANCE'] } } }),
      tx.client.groupBy({ by: ['status'], where: { tenantId: id }, _count: { _all: true } }),
      tx.order.findMany({ where: { tenantId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      tx.brokerBankRelationship.findMany({ where: { tenantId: id }, include: { bank: true } }),
      tx.complianceFlag.findMany({ where: { tenantId: id }, orderBy: { raisedAt: 'desc' } }),
    ]);
    const actions = await tx.auditLog.findMany({ where: { tenantId: id }, orderBy: { createdAt: 'desc' }, take: 200 });
    const changes = await tx.dataChange.findMany({ where: { tenantId: id }, orderBy: { id: 'desc' }, take: 200 });
    return {
      kind: 'tenant',
      title: t.legalNameEn,
      summary: redactRow(t as unknown as Record<string, unknown>),
      sections: {
        staff: users.map((u) => redactRow({ id: u.id, email: u.email, mobile: u.mobile, roles: u.roles.join(', '), createdAt: u.createdAt })),
        clients: clientsByStatus.map((g) => ({ status: g.status, count: g._count._all })),
        banks: relations.map((r) => ({ bank: r.bank.code, account: r.brokerAccountAtBank, active: r.active })),
        latestOrders: orders.map((o) => redactRow({ id: o.id, createdAt: o.createdAt, side: o.side === '1' ? 'BUY' : 'SELL', isin: o.isin, qty: o.orderQty, status: o.ordStatus })),
        flags: flags.map((x) => redactRow(x as unknown as Record<string, unknown>)),
      },
      timeline: await this.decorate(tx, [
        ...actions.map((a) => this.fromAction(a)),
        ...changes.map((c) => this.fromChange(c)),
      ]),
    };
  }

  private async order360(tx: Tx, id: string) {
    const o = await tx.order.findUnique({ where: { id }, include: { executions: true, priceSnapshot: true } });
    if (!o) throw new NotFoundException('Order not found');
    const client = await tx.client.findUnique({ where: { id: o.clientId } });
    const entries = await tx.journalEntry.findMany({
      where: { OR: [{ reference: { in: o.executions.map((e) => `${e.bankId}:${e.execId}`) } }, { reference: o.id }] },
      include: { postings: { include: { account: true } } },
    });
    const qr = await tx.quote.findUnique({ where: { id: o.quoteId }, include: { quoteRequest: true } });
    return {
      kind: 'order',
      title: `${o.side === '1' ? 'Buy' : 'Sell'} ${o.isin}`,
      summary: redactRow({ ...o, executions: undefined, priceSnapshot: undefined }),
      sections: {
        price: [redactRow(o.priceSnapshot as unknown as Record<string, unknown>)],
        executions: o.executions.map((e) => redactRow(e as unknown as Record<string, unknown>)),
        quote: qr ? [redactRow({ ...qr, quoteRequest: undefined, quoteReqId: qr.quoteRequest.quoteReqId })] : [],
      },
      links: { client: client ? { kind: 'client', id: client.id, title: client.fullNameEn } : null },
      timeline: await this.timeline(tx, { rowIds: [o.id, o.priceSnapshotId, ...o.executions.map((e) => e.id)], actorIds: [], entityIds: [o.id], entries, clOrdIds: [o.clOrdId] }),
    };
  }

  private async user360(tx: Tx, id: string) {
    const u = await tx.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    const client = await tx.client.findUnique({ where: { userId: id } });
    if (client) return this.client360(tx, client.id);
    return {
      kind: 'user',
      title: u.email,
      summary: redactRow(u as unknown as Record<string, unknown>),
      sections: {},
      timeline: await this.timeline(tx, { rowIds: [id], actorIds: [id], entityIds: [id], entries: [], clOrdIds: [] }),
    };
  }

  private async instrument360(tx: Tx, isin: string) {
    const i = await tx.instrument.findUnique({ where: { isin } });
    if (!i) throw new NotFoundException('Instrument not found');
    const [rate, orders, events] = await Promise.all([
      tx.indicativeRate.findUnique({ where: { isin } }),
      tx.order.findMany({ where: { isin }, orderBy: { createdAt: 'desc' }, take: 50 }),
      tx.incomeEvent.findMany({ where: { isin }, orderBy: { paymentDate: 'desc' } }),
    ]);
    return {
      kind: 'instrument',
      title: i.nameEn,
      summary: redactRow(i as unknown as Record<string, unknown>),
      sections: {
        indicativeRate: rate ? [redactRow(rate as unknown as Record<string, unknown>)] : [],
        orders: orders.map((o) => redactRow({ id: o.id, createdAt: o.createdAt, side: o.side === '1' ? 'BUY' : 'SELL', qty: o.orderQty, status: o.ordStatus })),
        income: events.map((e) => redactRow(e as unknown as Record<string, unknown>)),
      },
      timeline: await this.timeline(tx, { rowIds: [i.id, isin], actorIds: [], entityIds: [i.id, isin], entries: [], clOrdIds: [] }),
    };
  }

  // --- Timeline -----------------------------------------------------------------------------

  private async timeline(
    tx: Tx,
    q: {
      rowIds: string[];
      actorIds: string[];
      entityIds: string[];
      entries: { id: string; eventType: string; reference: string; createdAt: Date; createdById: string | null; postings: { amount: Prisma.Decimal; account: { type: string; unit: string } }[] }[];
      clOrdIds: string[];
    },
  ) {
    const [actions, changes, fix] = await Promise.all([
      tx.auditLog.findMany({ where: { OR: [{ entityId: { in: q.entityIds } }, { actorId: { in: q.actorIds } }] }, orderBy: { createdAt: 'desc' }, take: 300 }),
      tx.dataChange.findMany({ where: { rowId: { in: q.rowIds } }, orderBy: { id: 'desc' }, take: 300 }),
      q.clOrdIds.length
        ? tx.fixMessage.findMany({ where: { OR: q.clOrdIds.flatMap((id) => [{ raw: { contains: `|11=${id}|` } }, { raw: { contains: `\u000111=${id}\u0001` } }]) }, orderBy: { id: 'desc' }, take: 100 })
        : Promise.resolve([]),
    ]);
    const items: TimelineItem[] = [
      ...actions.map((a) => this.fromAction(a)),
      ...changes.map((c) => this.fromChange(c)),
      ...q.entries.map((e) => ({
        at: e.createdAt,
        kind: 'LEDGER' as const,
        title: `Ledger · ${e.eventType}`,
        detail: e.postings.map((p) => `${p.account.type} ${p.account.unit} ${p.amount.neg().toString()}`),
        actor: e.createdById,
        ref: e.reference,
      })),
      ...fix.map((m) => ({
        at: m.createdAt,
        kind: 'FIX' as const,
        title: `FIX ${m.direction} ${m.msgType} · ${m.sessionId}`,
        detail: m.raw.replace(/\u0001/g, '|'),
        ref: String(m.seqNum),
      })),
    ];
    return this.decorate(tx, items);
  }

  private fromAction(a: { createdAt: Date; action: string; entity: string; data: Prisma.JsonValue; actorId: string | null; ip: string | null; outcome: number | null; requestId: string | null }): TimelineItem {
    const signIn = /\/auth\/(login|verify-otp)/.test(a.action);
    return {
      at: a.createdAt,
      kind: signIn ? 'SIGN_IN' : 'ACTION',
      title: a.entity === 'Request' ? `${a.action}${a.outcome ? ` → ${a.outcome}` : ''}` : a.action,
      detail: { ...(a.data as object | null), ...(a.ip ? { ip: a.ip } : {}) },
      actor: a.actorId,
      ref: a.requestId,
    };
  }

  private fromChange(c: { at: Date; tableName: string; op: string; rowId: string | null; changes: Prisma.JsonValue; actorId: string | null; requestId: string | null }): TimelineItem {
    return { at: c.at, kind: 'DATA', title: `${c.op} ${c.tableName}`, detail: c.changes, actor: c.actorId, ref: c.rowId };
  }

  /** Newest first, with actor emails instead of ids. */
  private async decorate(tx: Tx, items: TimelineItem[]) {
    const ids = [...new Set(items.map((i) => i.actor).filter((x): x is string => !!x))];
    const users = new Map((await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));
    return items
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 400)
      .map((i) => ({ ...i, actor: i.actor ? users.get(i.actor) ?? i.actor : null }));
  }

  // --- Audit log ------------------------------------------------------------------------------

  async audit(q: { type: 'actions' | 'changes'; tenant?: string; actor?: string; action?: string; entity?: string; from?: string; to?: string; text?: string; skip: number; take: number }) {
    return this.db.asSystem(async (tx) => {
      const tenantId = q.tenant ? (await tx.tenant.findUnique({ where: { slug: q.tenant } }))?.id ?? '__none__' : undefined;
      const actorIds = q.actor
        ? (await tx.user.findMany({ where: { email: { contains: q.actor, mode: 'insensitive' } }, select: { id: true } })).map((u) => u.id)
        : undefined;
      const at = { ...(q.from ? { gte: new Date(`${q.from}T00:00:00Z`) } : {}), ...(q.to ? { lt: new Date(new Date(`${q.to}T00:00:00Z`).getTime() + 86_400_000) } : {}) };
      const users = async (ids: (string | null)[]) =>
        new Map((await tx.user.findMany({ where: { id: { in: ids.filter((x): x is string => !!x) } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));
      const tenantNames = new Map((await tx.tenant.findMany({ select: { id: true, slug: true } })).map((t) => [t.id, t.slug]));

      if (q.type === 'changes') {
        const where: Prisma.DataChangeWhereInput = {
          ...(tenantId ? { tenantId } : {}),
          ...(actorIds ? { actorId: { in: actorIds } } : {}),
          ...(q.entity ? { tableName: q.entity } : {}),
          ...(q.action ? { op: q.action } : {}),
          ...(q.from || q.to ? { at } : {}),
          ...(q.text ? { rowId: { contains: q.text } } : {}),
        };
        const [rows, total, tables] = await Promise.all([
          tx.dataChange.findMany({ where, orderBy: { id: 'desc' }, skip: q.skip, take: q.take }),
          tx.dataChange.count({ where }),
          tx.dataChange.findMany({ distinct: ['tableName'], select: { tableName: true } }),
        ]);
        const names = await users(rows.map((r) => r.actorId));
        return {
          total,
          facets: { entities: tables.map((t) => t.tableName).sort(), actions: ['INSERT', 'UPDATE', 'DELETE'] },
          rows: rows.map((r) => ({ ...r, id: r.id.toString(), actor: r.actorId ? names.get(r.actorId) ?? r.actorId : null, tenant: r.tenantId ? tenantNames.get(r.tenantId) ?? null : null })),
        };
      }

      const where: Prisma.AuditLogWhereInput = {
        ...(tenantId ? { tenantId } : {}),
        ...(actorIds ? { actorId: { in: actorIds } } : {}),
        ...(q.action ? { action: { contains: q.action, mode: 'insensitive' } } : {}),
        ...(q.entity ? { entity: q.entity } : {}),
        ...(q.from || q.to ? { createdAt: at } : {}),
        ...(q.text ? { OR: [{ entityId: { contains: q.text } }, { ip: { contains: q.text } }, { action: { contains: q.text, mode: 'insensitive' } }] } : {}),
      };
      const [rows, total, entities] = await Promise.all([
        tx.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.take }),
        tx.auditLog.count({ where }),
        tx.auditLog.findMany({ distinct: ['entity'], select: { entity: true } }),
      ]);
      const names = await users(rows.map((r) => r.actorId));
      return {
        total,
        facets: { entities: entities.map((e) => e.entity).sort(), actions: [] },
        rows: rows.map((r) => ({ ...r, actor: r.actorId ? names.get(r.actorId) ?? r.actorId : null, tenant: r.tenantId ? tenantNames.get(r.tenantId) ?? null : null })),
      };
    });
  }
}
