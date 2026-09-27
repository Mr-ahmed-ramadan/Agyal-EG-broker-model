import Decimal from 'decimal.js';
import { addMonths, toUtcDate } from './fixed-income';

/**
 * Coupons and redemptions (ADR 0007). T-bills pay face value at maturity;
 * coupon bonds and sukuk pay coupon = face x rate / frequency on each coupon
 * date and face value at maturity (with the final coupon).
 */

export type IncomeType = 'COUPON' | 'REDEMPTION';

export interface IncomeInstrument {
  type: string;
  couponRate: number | null;
  couponFreq: number | null;
  maturityDate: Date;
}

export interface ScheduledPayment {
  type: IncomeType;
  paymentDate: Date;
  /** Cash per 100 of face value */
  per100: number;
}

/** Payments falling within [from, to] (inclusive, UTC dates). */
export function incomeSchedule(i: IncomeInstrument, from: Date, to: Date): ScheduledPayment[] {
  const start = toUtcDate(from);
  const end = toUtcDate(to);
  const maturity = toUtcDate(i.maturityDate);
  const out: ScheduledPayment[] = [];

  if (i.type !== 'TREASURY_BILL' && i.couponRate != null && i.couponFreq) {
    const step = 12 / i.couponFreq;
    const per100 = (100 * i.couponRate) / i.couponFreq;
    for (let k = 0; ; k++) {
      const date = addMonths(maturity, -step * k);
      if (date < start) break;
      if (date <= end) out.push({ type: 'COUPON', paymentDate: date, per100 });
    }
  }
  if (maturity >= start && maturity <= end) out.push({ type: 'REDEMPTION', paymentDate: maturity, per100: 100 });
  return out.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime() || a.type.localeCompare(b.type));
}

/** Cash for a holding: nominal x per100 / 100, rounded to piastres. */
export function entitlementAmount(nominal: Decimal.Value, per100: Decimal.Value): Decimal {
  return new Decimal(nominal).mul(per100).div(100).toDecimalPlaces(2);
}

/** Tax withheld on a coupon at the broker's configured rate (0 unless set). */
export function withholding(amount: Decimal.Value, rate: number): Decimal {
  if (rate < 0 || rate >= 1) throw new Error('Withholding rate must be in [0, 1)');
  return new Decimal(amount).mul(rate).toDecimalPlaces(2);
}

export function eventKey(isin: string, type: IncomeType, paymentDate: Date): string {
  return `${isin}:${type}:${toUtcDate(paymentDate).toISOString().slice(0, 10)}`;
}
