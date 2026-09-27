import Decimal from 'decimal.js';
import { accruedInterest, bondCleanPrice, daysBetween, tbillPriceFromYield, toUtcDate } from './fixed-income';
import { incomeSchedule, type IncomeType } from './income';
import type { PricingInstrument, PricingRule } from './pricing';

/**
 * "If you invest today": what a client pays, receives and earns by holding a
 * paper to maturity. Estimates for display; the binding price comes from a
 * live bank quote.
 *
 * Interest is the coupons (bonds, sukuk) or the discount (T-bills: face value
 * minus price). Tax is the configured rate times that interest. A bond bought
 * below or above face value also has a price gain or loss at maturity, shown
 * separately and not taxed here.
 */

export interface ProjectionPayment {
  type: IncomeType;
  paymentDate: Date;
  gross: string;
  /** Part of the payment that is interest (taxed) */
  interest: string;
  tax: string;
  net: string;
}

export interface Projection {
  settlDate: Date;
  maturityDate: Date;
  termDays: number;
  nominal: string;
  clientCleanPx: string;
  clientYield: string;
  /** nominal x clean price */
  principal: string;
  accruedInterest: string;
  commission: string;
  /** What the client pays: principal + accrued + commission */
  totalCost: string;
  payments: ProjectionPayment[];
  totalReceivedGross: string;
  totalInterest: string;
  totalTax: string;
  totalReceivedNet: string;
  /** Bonds: face value minus clean price paid (T-bills: 0, the discount is interest) */
  priceGain: string;
  /** Net received minus total cost */
  netProfit: string;
  /** netProfit / totalCost, annualised on a 365-day year */
  netAnnualReturn: string;
}

export interface ProjectionInput {
  instrument: PricingInstrument;
  settlDate: Date;
  /** Client yield (after the broker's markup) */
  clientYield: number;
  /** Clean price per 100 from a live quote; computed from the yield if absent */
  clientCleanPx?: number;
  /** Nominal (face value) */
  nominal: Decimal.Value;
  rule: PricingRule;
  /** Tax on interest, e.g. 0.2 */
  taxRate: number;
}

const money = (d: Decimal) => d.toDecimalPlaces(2);

export function commissionFor(nominal: Decimal.Value, rule: PricingRule): Decimal {
  return money(Decimal.max(new Decimal(rule.commissionMin), new Decimal(nominal).mul(rule.commissionBps).div(10_000)));
}

/** Client clean price and accrued interest per 100 face value at a client yield. */
export function clientPricePer100(i: PricingInstrument, clientYield: number, settle: Date): { clean: number; accrued: number } {
  if (i.type === 'TREASURY_BILL') return { clean: tbillPriceFromYield(clientYield, settle, i.maturityDate), accrued: 0 };
  if (i.couponRate == null || i.couponFreq == null) throw new Error('Coupon instrument requires couponRate and couponFreq');
  const bond = { couponRate: i.couponRate, couponFreq: i.couponFreq, maturity: i.maturityDate };
  return { clean: bondCleanPrice(bond, clientYield, settle), accrued: accruedInterest(bond, settle) };
}

/**
 * Largest nominal (a multiple of the increment, at least the minimum) whose
 * total cost including commission fits in the amount; null if even the
 * minimum doesn't fit.
 */
export function nominalForAmount(
  amount: Decimal.Value,
  dirtyPer100: number,
  rule: PricingRule,
  minQty: Decimal.Value,
  increment: Decimal.Value,
): Decimal | null {
  const budget = new Decimal(amount);
  const step = new Decimal(increment);
  const cost = (n: Decimal) => money(n.mul(dirtyPer100).div(100)).plus(commissionFor(n, rule));
  const perUnit = new Decimal(dirtyPer100).div(100).plus(new Decimal(rule.commissionBps).div(10_000));
  let n = budget.div(perUnit).div(step).floor().mul(step);
  while (n.gte(minQty) && cost(n).gt(budget)) n = n.minus(step);
  return n.gte(minQty) ? n : null;
}

export function projectHolding(input: ProjectionInput): Projection {
  const { instrument, rule, taxRate } = input;
  if (taxRate < 0 || taxRate >= 1) throw new Error('Tax rate must be in [0, 1)');
  const settle = toUtcDate(input.settlDate);
  const maturity = toUtcDate(instrument.maturityDate);
  const termDays = daysBetween(settle, maturity);
  if (termDays <= 0) throw new Error('Settlement must be before maturity');
  const nominal = new Decimal(input.nominal);
  if (!nominal.gt(0)) throw new Error('Nominal must be positive');

  const px = clientPricePer100(instrument, input.clientYield, settle);
  const clean = new Decimal(input.clientCleanPx ?? px.clean).toDecimalPlaces(6);
  const principal = money(nominal.mul(clean).div(100));
  const accrued = money(nominal.mul(px.accrued).div(100));
  const commission = commissionFor(nominal, rule);
  const totalCost = principal.plus(accrued).plus(commission);

  // Payments strictly after settlement (a coupon paid on the settlement date goes to the seller).
  const schedule = incomeSchedule(
    { type: instrument.type, couponRate: instrument.couponRate, couponFreq: instrument.couponFreq, maturityDate: maturity },
    new Date(settle.getTime() + 86_400_000),
    maturity,
  );
  const isBill = instrument.type === 'TREASURY_BILL';
  const payments: ProjectionPayment[] = schedule.map((p) => {
    const gross = money(nominal.mul(p.per100).div(100));
    const interest = p.type === 'COUPON' ? gross : isBill ? Decimal.max(0, gross.minus(principal)) : new Decimal(0);
    const tax = money(interest.mul(taxRate));
    return {
      type: p.type,
      paymentDate: p.paymentDate,
      gross: gross.toFixed(2),
      interest: interest.toFixed(2),
      tax: tax.toFixed(2),
      net: gross.minus(tax).toFixed(2),
    };
  });

  const sum = (f: (p: ProjectionPayment) => string) => payments.reduce((s, p) => s.plus(f(p)), new Decimal(0));
  const received = sum((p) => p.gross);
  const net = sum((p) => p.net);
  const netProfit = net.minus(totalCost);
  const annual = netProfit.div(totalCost).mul(365).div(termDays);

  return {
    settlDate: settle,
    maturityDate: maturity,
    termDays,
    nominal: nominal.toFixed(2),
    clientCleanPx: clean.toFixed(6),
    clientYield: new Decimal(input.clientYield).toDecimalPlaces(6).toFixed(6),
    principal: principal.toFixed(2),
    accruedInterest: accrued.toFixed(2),
    commission: commission.toFixed(2),
    totalCost: totalCost.toFixed(2),
    payments,
    totalReceivedGross: received.toFixed(2),
    totalInterest: sum((p) => p.interest).toFixed(2),
    totalTax: sum((p) => p.tax).toFixed(2),
    totalReceivedNet: net.toFixed(2),
    priceGain: isBill ? '0.00' : nominal.minus(principal).toFixed(2),
    netProfit: netProfit.toFixed(2),
    netAnnualReturn: annual.toDecimalPlaces(6).toFixed(6),
  };
}

/** Tax on a T-bill redemption: rate x (face value - what the client paid for it). */
export function billRedemptionTax(nominal: Decimal.Value, avgCleanPx: Decimal.Value, taxRate: number): Decimal {
  const discount = new Decimal(nominal).mul(new Decimal(100).minus(avgCleanPx)).div(100);
  return money(Decimal.max(0, discount).mul(taxRate));
}
