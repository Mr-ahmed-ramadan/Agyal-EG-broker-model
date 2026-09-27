import Decimal from 'decimal.js';
import {
  accruedInterest,
  bondCleanPrice,
  bondYieldFromCleanPrice,
  tbillPriceFromYield,
  tbillYieldFromPrice,
  type CouponBond,
} from './fixed-income';

/**
 * Client pricing from a bank quote (ADR 0008).
 *
 * The broker's markup is expressed in yield basis points and always works
 * against the client: on a buy the client's yield is the bank's offer yield
 * minus the markup (client pays a higher price); on a sell it is the bank's
 * bid yield plus the markup (client receives a lower price). The client's
 * price is recomputed from that yield. Commission is a separate, disclosed
 * fee added to a buy and deducted from sale proceeds.
 */

export type TradeSide = 'BUY' | 'SELL';

export type InstrumentType = 'TREASURY_BOND' | 'TREASURY_BILL' | 'CORPORATE_BOND' | 'SUKUK';

export interface PricingRule {
  markupBps: number;
  commissionBps: number;
  commissionMin: string;
}

/** Per-tenant pricing config, stored in Tenant.config.pricing. */
export interface PricingConfig {
  default: PricingRule;
  /** Overrides by instrument type (most specific wins). */
  byInstrumentType?: Partial<Record<InstrumentType, Partial<PricingRule>>>;
  /** Guardrail: the platform refuses rules above this markup. */
  maxMarkupBps: number;
}

export function resolvePricingRule(config: PricingConfig, type: InstrumentType): PricingRule {
  const rule = { ...config.default, ...(config.byInstrumentType?.[type] ?? {}) };
  if (rule.markupBps < 0 || rule.markupBps > config.maxMarkupBps) {
    throw new Error(`Markup ${rule.markupBps}bps outside allowed range 0-${config.maxMarkupBps}`);
  }
  return rule;
}

export interface PricingInstrument {
  type: InstrumentType;
  couponRate: number | null;
  couponFreq: number | null;
  maturityDate: Date;
}

export interface ClientPriceInput {
  side: TradeSide;
  instrument: PricingInstrument;
  /** Bank's offer (buy) or bid (sell), clean price per 100 */
  bankCleanPx: number;
  /** Nominal (face value) */
  quantity: string;
  settlDate: Date;
  rule: PricingRule;
}

export interface ClientPrice {
  bankCleanPx: string;
  bankYield: string;
  markupBps: number;
  clientCleanPx: string;
  clientYield: string;
  /** Accrued interest amount for the quantity (0 for T-bills) */
  accruedInterest: string;
  /** quantity x clientCleanPx / 100 */
  principal: string;
  commission: string;
  /** Buy: total the client pays. Sell: net proceeds the client receives. */
  netAmount: string;
}

const PX_DP = 6;
const YIELD_DP = 6;
const MONEY_DP = 2;

function asBond(i: PricingInstrument): CouponBond {
  if (i.couponRate == null || i.couponFreq == null) {
    throw new Error('Coupon instrument requires couponRate and couponFreq');
  }
  return { couponRate: i.couponRate, couponFreq: i.couponFreq, maturity: i.maturityDate };
}

/** Prices a client trade from the bank's quote. */
export function priceClient(input: ClientPriceInput): ClientPrice {
  const { instrument, bankCleanPx, settlDate, rule } = input;
  const qty = new Decimal(input.quantity);
  if (!qty.gt(0)) throw new Error('Quantity must be positive');
  // Yield adjustment against the client: lower yield on a buy, higher on a sell.
  const yieldAdjustment = ((input.side === 'BUY' ? -1 : 1) * rule.markupBps) / 10_000;

  let bankYield: number;
  let clientCleanPx: number;
  let accruedPer100: number;

  if (instrument.type === 'TREASURY_BILL') {
    bankYield = tbillYieldFromPrice(bankCleanPx, settlDate, instrument.maturityDate);
    clientCleanPx = tbillPriceFromYield(bankYield + yieldAdjustment, settlDate, instrument.maturityDate);
    accruedPer100 = 0;
  } else {
    const bond = asBond(instrument);
    bankYield = bondYieldFromCleanPrice(bond, bankCleanPx, settlDate);
    clientCleanPx = bondCleanPrice(bond, bankYield + yieldAdjustment, settlDate);
    accruedPer100 = accruedInterest(bond, settlDate);
  }

  const clientYield = bankYield + yieldAdjustment;
  if (clientYield <= 0) throw new Error('Markup leaves a non-positive client yield');

  const px = new Decimal(clientCleanPx).toDecimalPlaces(PX_DP);
  const principal = qty.mul(px).div(100).toDecimalPlaces(MONEY_DP);
  const accrued = qty.mul(accruedPer100).div(100).toDecimalPlaces(MONEY_DP);
  const commission = Decimal.max(
    new Decimal(rule.commissionMin),
    qty.mul(rule.commissionBps).div(10_000),
  ).toDecimalPlaces(MONEY_DP);
  const gross = principal.plus(accrued);
  const netAmount = input.side === 'BUY' ? gross.plus(commission) : gross.minus(commission);
  if (!netAmount.gt(0)) throw new Error('Commission exceeds sale proceeds');

  return {
    bankCleanPx: new Decimal(bankCleanPx).toDecimalPlaces(PX_DP).toFixed(PX_DP),
    bankYield: new Decimal(bankYield).toDecimalPlaces(YIELD_DP).toFixed(YIELD_DP),
    markupBps: rule.markupBps,
    clientCleanPx: px.toFixed(PX_DP),
    clientYield: new Decimal(clientYield).toDecimalPlaces(YIELD_DP).toFixed(YIELD_DP),
    accruedInterest: accrued.toFixed(MONEY_DP),
    principal: principal.toFixed(MONEY_DP),
    commission: commission.toFixed(MONEY_DP),
    netAmount: netAmount.toFixed(MONEY_DP),
  };
}

export function disclosureText(side: TradeSide, p: ClientPrice): string {
  return (
    `${side === 'BUY' ? 'Buy' : 'Sell'} at clean price ${p.clientCleanPx} per 100 ` +
    `(yield ${(Number(p.clientYield) * 100).toFixed(3)}%), ` +
    `principal EGP ${p.principal}, accrued interest EGP ${p.accruedInterest}, ` +
    `commission EGP ${p.commission}, ` +
    `${side === 'BUY' ? 'total to pay' : 'net proceeds'} EGP ${p.netAmount}.`
  );
}
