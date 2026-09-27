import { Body, Controller, Delete, Get, NotFoundException, Param, Put } from '@nestjs/common';
import type { Prisma, Tenant } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { DbService } from '../../common/db.service';
import { EconomicsService } from '../../common/economics.service';
import { parseBody } from '../../common/validation';
import { waterfall, type Economics, type EconomicsOverrides } from '../../domain/economics';
import { LedgerAccountType } from '../../domain/ledger-rules';
import { InstrumentsService } from '../instruments/instruments.service';

const bps = z.number().int().min(0).max(1000);
const rate = z.number().min(0).lt(1);
const types = z.object({ TREASURY_BILL: rate, TREASURY_BOND: rate, CORPORATE_BOND: rate, SUKUK: rate });
const tenors = z.object({ UP_TO_3M: rate, UP_TO_6M: rate, UP_TO_1Y: rate, OVER_1Y: rate });

const EconomicsSchema = z.object({
  custodyBps: bps,
  brokerMarginBps: bps,
  platformMarginBps: bps,
  commissionBps: bps,
  commissionMin: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxRates: types,
  depositRates: tenors,
  showBreakdownToClients: z.boolean(),
  maxTotalDeductionBps: bps,
});
const OverridesSchema = EconomicsSchema.partial().extend({ taxRates: types.partial().optional(), depositRates: tenors.partial().optional() });

/** The one-year bond used to illustrate economics in the consoles. */
export const EXAMPLE = { type: 'TREASURY_BOND' as const, marketYield: 0.255, termDays: 365 };

interface MonthRow {
  month: string;
  tenantId: string;
  volume: string;
  trades: number;
  brokerRevenue: string;
  platformFee: string;
  custodyFee: string;
}

@Controller()
export class EconomicsController {
  constructor(
    private readonly economics: EconomicsService,
    private readonly instruments: InstrumentsService,
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  // --- Agyal admin ----------------------------------------------------------------------------

  @Get('admin/economics')
  @Auth('PLATFORM_ADMIN')
  async platform() {
    const defaults = await this.economics.platformDefaults();
    const tenants = await this.db.tenant.findMany({ orderBy: { legalNameEn: 'asc' } });
    const brokers = await Promise.all(
      tenants.map(async (t) => {
        const effective = await this.economics.forTenant(t);
        const report = await this.instruments.economicsReport(t, effective);
        return {
          slug: t.slug,
          name: t.legalNameEn,
          kind: t.kind,
          overrides: this.economics.overridesOf(t),
          effective,
          papersBelowDeposit: report.filter((r) => r.belowDeposit).length,
        };
      }),
    );
    return { defaults, example: { ...EXAMPLE, waterfall: waterfall(defaults, EXAMPLE.type, EXAMPLE.marketYield, EXAMPLE.termDays) }, brokers };
  }

  @Put('admin/economics')
  @Auth('PLATFORM_ADMIN')
  async savePlatform(@CurrentUser() u: AuthUser, @Body() body: unknown) {
    const input = parseBody(EconomicsSchema, body) as Economics;
    const saved = await this.economics.savePlatformDefaults(input, u.sub);
    await this.audit.record(this.db, { tenantId: null, actorId: u.sub, action: 'ECONOMICS_DEFAULTS_SET', entity: 'PlatformSetting', entityId: 'economics', data: input as unknown as Prisma.InputJsonValue });
    return saved;
  }

  @Put('admin/tenants/:slug/economics')
  @Auth('PLATFORM_ADMIN')
  async saveBroker(@CurrentUser() u: AuthUser, @Param('slug') slug: string, @Body() body: unknown) {
    const overrides = parseBody(OverridesSchema, body) as EconomicsOverrides;
    const tenant = await this.tenantBySlug(slug);
    const effective = await this.economics.validateOverrides(overrides);
    await this.setOverrides(tenant, overrides);
    await this.audit.record(this.db, { tenantId: tenant.id, actorId: u.sub, action: 'ECONOMICS_OVERRIDES_SET', entity: 'Tenant', entityId: tenant.id, data: overrides as unknown as Prisma.InputJsonValue });
    return { overrides, effective };
  }

  @Delete('admin/tenants/:slug/economics')
  @Auth('PLATFORM_ADMIN')
  async resetBroker(@CurrentUser() u: AuthUser, @Param('slug') slug: string) {
    const tenant = await this.tenantBySlug(slug);
    await this.setOverrides(tenant, null);
    await this.audit.record(this.db, { tenantId: tenant.id, actorId: u.sub, action: 'ECONOMICS_OVERRIDES_RESET', entity: 'Tenant', entityId: tenant.id, data: {} });
    return { overrides: {}, effective: await this.economics.platformDefaults() };
  }

  /** Agyal's revenue by broker and month (platform fee accrued on fills). */
  @Get('admin/revenue')
  @Auth('PLATFORM_ADMIN')
  async platformRevenue() {
    const rows = await this.db.asSystem((tx) => this.monthly(tx));
    const tenants = new Map((await this.db.tenant.findMany()).map((t) => [t.id, t]));
    return rows.map((r) => ({ ...r, slug: tenants.get(r.tenantId)?.slug, name: tenants.get(r.tenantId)?.legalNameEn }));
  }

  // --- Broker ---------------------------------------------------------------------------------

  /** Broker: the economics they trade under (read only) and their monthly results. */
  @Get('broker/economics')
  @Auth('BROKER_ADMIN', 'BROKER_FINANCE', 'BROKER_OPS', 'BROKER_DEALER')
  async broker(@CurrentTenant() t: Tenant) {
    const effective = await this.economics.forTenant(t);
    return {
      effective,
      example: { ...EXAMPLE, waterfall: waterfall(effective, EXAMPLE.type, EXAMPLE.marketYield, EXAMPLE.termDays) },
      papers: await this.instruments.economicsReport(t, effective),
      months: await this.db.forTenant(t.id, (tx) => this.monthly(tx)),
    };
  }

  // --- helpers --------------------------------------------------------------------------------

  private async tenantBySlug(slug: string) {
    const tenant = await this.db.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Broker not found');
    return tenant;
  }

  private async setOverrides(tenant: Tenant, overrides: EconomicsOverrides | null) {
    const config = { ...((tenant.config ?? {}) as Record<string, unknown>) };
    if (overrides && Object.keys(overrides).length) config.economics = overrides;
    else delete config.economics;
    await this.db.asSystem((tx) => tx.tenant.update({ where: { id: tenant.id }, data: { config: config as Prisma.InputJsonValue } }));
  }

  /** Volume and revenue split per month from fill journal entries (RLS scopes the rows). */
  private async monthly(tx: Prisma.TransactionClient): Promise<MonthRow[]> {
    const rows = await tx.$queryRaw<{ month: string; tenantId: string; type: string; total: string; trades: number }[]>`
      SELECT to_char(date_trunc('month', j."createdAt"), 'YYYY-MM') AS month, j."tenantId", a.type,
             SUM(p.amount)::text AS total, COUNT(DISTINCT j.id)::int AS trades
      FROM "Posting" p
      JOIN "LedgerAccount" a ON a.id = p."accountId"
      JOIN "JournalEntry" j ON j.id = p."journalEntryId"
      WHERE j."eventType" IN ('BUY_FILL', 'SELL_FILL')
        AND a.type IN (${LedgerAccountType.BROKER_REVENUE}, ${LedgerAccountType.PLATFORM_FEE_PAYABLE},
                       ${LedgerAccountType.CUSTODY_FEE_PAYABLE}, ${LedgerAccountType.SETTLEMENT_PAYABLE},
                       ${LedgerAccountType.SETTLEMENT_RECEIVABLE})
      GROUP BY 1, 2, 3
      ORDER BY 1 DESC`;
    const out = new Map<string, MonthRow & { vol: number; b: number; p: number; c: number }>();
    for (const r of rows) {
      const key = `${r.month}|${r.tenantId}`;
      const row = out.get(key) ?? { month: r.month, tenantId: r.tenantId, volume: '0', trades: 0, brokerRevenue: '0', platformFee: '0', custodyFee: '0', vol: 0, b: 0, p: 0, c: 0 };
      const v = Number(r.total);
      if (r.type === LedgerAccountType.SETTLEMENT_PAYABLE) { row.vol += -v; row.trades += r.trades; }
      if (r.type === LedgerAccountType.SETTLEMENT_RECEIVABLE) { row.vol += v; row.trades += r.trades; }
      if (r.type === LedgerAccountType.BROKER_REVENUE) row.b += -v;
      if (r.type === LedgerAccountType.PLATFORM_FEE_PAYABLE) row.p += -v;
      if (r.type === LedgerAccountType.CUSTODY_FEE_PAYABLE) row.c += -v;
      out.set(key, row);
    }
    return [...out.values()].map(({ vol, b, p, c, ...r }) => ({
      ...r,
      volume: vol.toFixed(2),
      brokerRevenue: b.toFixed(2),
      platformFee: p.toFixed(2),
      custodyFee: c.toFixed(2),
    }));
  }
}
