import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Instrument, Tenant } from '@prisma/client';
import { DbService } from '../../common/db.service';
import { EconomicsService } from '../../common/economics.service';
import { tenantConfig } from '../../common/tenant-config';
import { addBusinessDays, bondYieldFromCleanPrice, daysBetween, tbillYieldFromPrice } from '../../domain/fixed-income';
import { clientWaterfall, waterfall, type Economics } from '../../domain/economics';
import { type PricingInstrument } from '../../domain/pricing';
import { clientPricePer100, nominalForAmount, projectHolding } from '../../domain/projection';

export function pricingInstrument(i: Instrument): PricingInstrument {
  return {
    type: i.type,
    couponRate: i.couponRate == null ? null : Number(i.couponRate),
    couponFreq: i.couponFreq,
    maturityDate: i.maturityDate,
  };
}

/** Bank yield implied by a clean price (for recording indicative rates from quotes). */
export function yieldFromCleanPrice(i: Instrument, cleanPx: number, settle: Date): number {
  const p = pricingInstrument(i);
  if (p.type === 'TREASURY_BILL') return tbillYieldFromPrice(cleanPx, settle, p.maturityDate);
  return bondYieldFromCleanPrice({ couponRate: p.couponRate!, couponFreq: p.couponFreq!, maturity: p.maturityDate }, cleanPx, settle);
}

@Injectable()
export class InstrumentsService {
  constructor(
    private readonly db: DbService,
    private readonly economics: EconomicsService,
  ) {}

  /**
   * Instruments this broker offers, with an indicative client yield (after
   * custody and margins), net yield after tax and the deposit comparison.
   */
  async list(tenant: Tenant) {
    const config = tenantConfig(tenant.config);
    const economics = await this.economics.forTenant(tenant);
    const settle = addBusinessDays(new Date(), config.settlementDays);
    const instruments = await this.db.instrument.findMany({
      where: { type: { in: config.enabledInstrumentTypes as Instrument['type'][] }, maturityDate: { gt: new Date() } },
      orderBy: [{ type: 'asc' }, { maturityDate: 'asc' }],
    });
    const rates = new Map(
      (await this.db.indicativeRate.findMany({ where: { isin: { in: instruments.map((i) => i.isin) } } })).map((r) => [r.isin, r]),
    );
    return instruments.map((i) => {
      const rate = rates.get(i.isin);
      const w = rate?.offerYield == null ? null : clientWaterfall(economics, i.type, Number(rate.offerYield), daysBetween(settle, i.maturityDate));
      return {
        ...i,
        indicativeYield: w ? w.clientYield!.toFixed(6) : null,
        indicativeAsOf: rate?.asOf ?? null,
        taxRate: economics.taxRates[i.type],
        returnBreakdown: w,
      };
    });
  }

  async byIsin(tenant: Tenant, isin: string): Promise<Instrument> {
    const instrument = await this.db.instrument.findUnique({ where: { isin } });
    const enabled = tenantConfig(tenant.config).enabledInstrumentTypes;
    if (!instrument || !enabled.includes(instrument.type)) {
      throw new NotFoundException('Instrument not available');
    }
    return instrument;
  }

  /**
   * Broker/admin view: each offered paper's waterfall at today's indicative
   * rate, flagging those where the client's net yield is below a deposit.
   */
  async economicsReport(tenant: Tenant, economics?: Economics) {
    const config = tenantConfig(tenant.config);
    const e = economics ?? (await this.economics.forTenant(tenant));
    const settle = addBusinessDays(new Date(), config.settlementDays);
    const instruments = await this.db.instrument.findMany({
      where: { type: { in: config.enabledInstrumentTypes as Instrument['type'][] }, maturityDate: { gt: settle } },
      orderBy: [{ type: 'asc' }, { maturityDate: 'asc' }],
    });
    const rates = new Map((await this.db.indicativeRate.findMany()).map((r) => [r.isin, r]));
    return instruments.flatMap((i) => {
      const r = rates.get(i.isin);
      if (r?.offerYield == null) return [];
      return [{ isin: i.isin, nameEn: i.nameEn, type: i.type, maturityDate: i.maturityDate, ...waterfall(e, i.type, Number(r.offerYield), daysBetween(settle, i.maturityDate)) }];
    });
  }


  /**
   * "If you invest today" at the indicative rate: for an amount of money
   * (largest nominal that fits, commission included) or a nominal.
   */
  async projection(tenant: Tenant, isin: string, q: { amount?: string; nominal?: string }) {
    const instrument = await this.byIsin(tenant, isin);
    const config = tenantConfig(tenant.config);
    const economics = await this.economics.forTenant(tenant);
    const rate = await this.db.indicativeRate.findUnique({ where: { isin } });
    if (rate?.offerYield == null) throw new NotFoundException('No indicative rate for this paper yet');
    const settlDate = addBusinessDays(new Date(), config.settlementDays);
    if (settlDate >= instrument.maturityDate) throw new BadRequestException('This paper matures before settlement');
    const rule = await this.economics.rule(tenant);
    const breakdown = clientWaterfall(economics, instrument.type, Number(rate.offerYield), daysBetween(settlDate, instrument.maturityDate));
    const clientYield = breakdown.clientYield!;
    const taxRate = economics.taxRates[instrument.type];
    const p = pricingInstrument(instrument);

    let nominal: Decimal | null;
    if (q.nominal) {
      nominal = new Decimal(q.nominal);
    } else {
      const amount = new Decimal(q.amount ?? '100000');
      if (!amount.gt(0)) throw new BadRequestException('Amount must be positive');
      const px = clientPricePer100(p, clientYield, settlDate);
      nominal = nominalForAmount(amount, px.clean + px.accrued, rule, instrument.minQty.toString(), instrument.qtyIncrement.toString());
      if (!nominal) {
        throw new BadRequestException(`The minimum for this paper is ${instrument.minQty.toFixed(0)} face value`);
      }
    }
    return {
      isin,
      indicative: true,
      asOf: rate.asOf,
      taxRate,
      commissionRule: { bps: rule.commissionBps, min: rule.commissionMin },
      returnBreakdown: breakdown,
      ...projectHolding({ instrument: p, settlDate, clientYield, nominal, rule, taxRate }),
    };
  }

  /** Platform admin: set an indicative bank offer yield by hand. */
  setIndicative(isin: string, offerYield: number) {
    if (!(offerYield > 0 && offerYield < 1)) throw new BadRequestException('Yield must be between 0 and 1 (e.g. 0.25 for 25%)');
    const data = { offerYield: offerYield.toFixed(6), bidYield: (offerYield + 0.003).toFixed(6), source: 'ADMIN', asOf: new Date() };
    return this.db.indicativeRate.upsert({ where: { isin }, create: { isin, ...data }, update: data });
  }
}
