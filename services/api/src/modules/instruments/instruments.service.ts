import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { Instrument, Tenant } from '@prisma/client';
import { DbService } from '../../common/db.service';
import { taxRateFor, tenantConfig } from '../../common/tenant-config';
import { addBusinessDays, bondYieldFromCleanPrice, tbillYieldFromPrice } from '../../domain/fixed-income';
import { resolvePricingRule, type PricingInstrument } from '../../domain/pricing';
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
  constructor(private readonly db: DbService) {}

  /** Instruments this broker offers, with an indicative client yield (after the broker's markup). */
  async list(tenant: Tenant) {
    const config = tenantConfig(tenant.config);
    const instruments = await this.db.instrument.findMany({
      where: { type: { in: config.enabledInstrumentTypes as Instrument['type'][] }, maturityDate: { gt: new Date() } },
      orderBy: [{ type: 'asc' }, { maturityDate: 'asc' }],
    });
    const rates = new Map(
      (await this.db.indicativeRate.findMany({ where: { isin: { in: instruments.map((i) => i.isin) } } })).map((r) => [r.isin, r]),
    );
    return instruments.map((i) => {
      const rate = rates.get(i.isin);
      const clientYield = rate?.offerYield == null ? null : this.clientYield(tenant, i, Number(rate.offerYield));
      return {
        ...i,
        indicativeYield: clientYield == null ? null : clientYield.toFixed(6),
        indicativeAsOf: rate?.asOf ?? null,
        taxRate: taxRateFor(config, i.type),
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

  /** Bank offer yield less the broker's markup (a buyer's yield), never below zero. */
  private clientYield(tenant: Tenant, i: Instrument, bankOfferYield: number): number {
    const rule = resolvePricingRule(tenantConfig(tenant.config).pricing, i.type);
    return Math.max(0, bankOfferYield - rule.markupBps / 10_000);
  }

  /**
   * "If you invest today" at the indicative rate: for an amount of money
   * (largest nominal that fits, commission included) or a nominal.
   */
  async projection(tenant: Tenant, isin: string, q: { amount?: string; nominal?: string }) {
    const instrument = await this.byIsin(tenant, isin);
    const config = tenantConfig(tenant.config);
    const rate = await this.db.indicativeRate.findUnique({ where: { isin } });
    if (rate?.offerYield == null) throw new NotFoundException('No indicative rate for this paper yet');
    const settlDate = addBusinessDays(new Date(), config.settlementDays);
    if (settlDate >= instrument.maturityDate) throw new BadRequestException('This paper matures before settlement');
    const rule = resolvePricingRule(config.pricing, instrument.type);
    const clientYield = this.clientYield(tenant, instrument, Number(rate.offerYield));
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
      taxRate: taxRateFor(config, instrument.type),
      commissionRule: { bps: rule.commissionBps, min: rule.commissionMin },
      ...projectHolding({ instrument: p, settlDate, clientYield, nominal, rule, taxRate: taxRateFor(config, instrument.type) }),
    };
  }

  /** Platform admin: set an indicative bank offer yield by hand. */
  setIndicative(isin: string, offerYield: number) {
    if (!(offerYield > 0 && offerYield < 1)) throw new BadRequestException('Yield must be between 0 and 1 (e.g. 0.25 for 25%)');
    const data = { offerYield: offerYield.toFixed(6), bidYield: (offerYield + 0.003).toFixed(6), source: 'ADMIN', asOf: new Date() };
    return this.db.indicativeRate.upsert({ where: { isin }, create: { isin, ...data }, update: data });
  }
}
