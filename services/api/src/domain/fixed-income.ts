/**
 * Fixed-income pricing math (ADR 0007, ADR 0008).
 *
 * Prices are per 100 of face value. Yields are annual fractions (0.25 = 25%).
 * Day count is Actual/365 for T-bills; coupon bonds use the standard street
 * convention (compounding at the coupon frequency, fractional first period
 * measured Actual/Actual within the coupon period).
 *
 * All dates are treated as UTC calendar dates.
 */

const MS_PER_DAY = 86_400_000;

export function toUtcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / MS_PER_DAY);
}

/** Adds months, clamping to the last day of the target month (e.g. 31 Jan + 1m = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)),
  );
}

// --- T-bills (discount instruments, Actual/365) ------------------------------

export function tbillPriceFromYield(yieldRate: number, settle: Date, maturity: Date): number {
  const days = daysBetween(settle, maturity);
  if (days <= 0) throw new Error('Settlement must be before maturity');
  return 100 / (1 + (yieldRate * days) / 365);
}

export function tbillYieldFromPrice(price: number, settle: Date, maturity: Date): number {
  const days = daysBetween(settle, maturity);
  if (days <= 0) throw new Error('Settlement must be before maturity');
  if (price <= 0) throw new Error('Price must be positive');
  return ((100 / price - 1) * 365) / days;
}

// --- Coupon bonds -------------------------------------------------------------

export interface CouponBond {
  /** Annual coupon rate as a fraction */
  couponRate: number;
  /** Coupons per year (1, 2, 4 or 12) */
  couponFreq: number;
  maturity: Date;
}

export interface CouponPeriod {
  previous: Date;
  next: Date;
  /** Coupons remaining, including the next one */
  remaining: number;
}

export function couponPeriod(bond: CouponBond, settle: Date): CouponPeriod {
  const s = toUtcDate(settle);
  const maturity = toUtcDate(bond.maturity);
  if (s >= maturity) throw new Error('Settlement must be before maturity');
  if (![1, 2, 4, 12].includes(bond.couponFreq)) {
    throw new Error(`Unsupported coupon frequency: ${bond.couponFreq}`);
  }
  const step = 12 / bond.couponFreq;
  let i = 0;
  // date(i) = maturity - i coupon periods; find date(i+1) <= settle < date(i)
  while (addMonths(maturity, -step * (i + 1)) > s) i++;
  return {
    next: addMonths(maturity, -step * i),
    previous: addMonths(maturity, -step * (i + 1)),
    remaining: i + 1,
  };
}

/** Accrued interest per 100 face value at settlement. */
export function accruedInterest(bond: CouponBond, settle: Date): number {
  const { previous, next } = couponPeriod(bond, settle);
  const coupon = (100 * bond.couponRate) / bond.couponFreq;
  return (coupon * daysBetween(previous, settle)) / daysBetween(previous, next);
}

/** Dirty price per 100 face value for a yield to maturity. */
export function bondDirtyPrice(bond: CouponBond, yieldRate: number, settle: Date): number {
  const { previous, next, remaining } = couponPeriod(bond, settle);
  const f = bond.couponFreq;
  const coupon = (100 * bond.couponRate) / f;
  const w = daysBetween(settle, next) / daysBetween(previous, next);
  const base = 1 + yieldRate / f;
  let pv = 0;
  for (let k = 0; k < remaining; k++) pv += coupon / base ** (k + w);
  pv += 100 / base ** (remaining - 1 + w);
  return pv;
}

export function bondCleanPrice(bond: CouponBond, yieldRate: number, settle: Date): number {
  return bondDirtyPrice(bond, yieldRate, settle) - accruedInterest(bond, settle);
}

/** Yield to maturity from a clean price, by bisection (price falls as yield rises). */
export function bondYieldFromCleanPrice(bond: CouponBond, cleanPrice: number, settle: Date): number {
  let lo = -0.5;
  let hi = 5;
  if (bondCleanPrice(bond, lo, settle) < cleanPrice || bondCleanPrice(bond, hi, settle) > cleanPrice) {
    throw new Error('Price outside solvable yield range');
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (bondCleanPrice(bond, mid, settle) > cleanPrice) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
}

// --- Settlement dates -------------------------------------------------------

/** Egyptian weekend: Friday (5) and Saturday (6). Public holidays: TODO calendar. */
export function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  return day !== 5 && day !== 6;
}

export function addBusinessDays(from: Date, days: number): Date {
  let d = toUtcDate(from);
  let added = 0;
  while (added < days) {
    d = new Date(d.getTime() + MS_PER_DAY);
    if (isBusinessDay(d)) added++;
  }
  return d;
}
