import { describe, expect, it } from 'vitest';
import {
  accruedInterest,
  addBusinessDays,
  addMonths,
  bondCleanPrice,
  bondYieldFromCleanPrice,
  couponPeriod,
  tbillPriceFromYield,
  tbillYieldFromPrice,
} from '../../src/domain/fixed-income';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('T-bills', () => {
  it('prices a 91-day bill at 25% on Actual/365', () => {
    expect(tbillPriceFromYield(0.25, d('2026-01-01'), d('2026-04-02'))).toBeCloseTo(94.1328, 4);
  });

  it('round-trips price and yield', () => {
    const p = tbillPriceFromYield(0.2735, d('2026-03-10'), d('2026-09-08'));
    expect(tbillYieldFromPrice(p, d('2026-03-10'), d('2026-09-08'))).toBeCloseTo(0.2735, 10);
  });
});

describe('coupon bonds', () => {
  const bond = { couponRate: 0.22, couponFreq: 2, maturity: d('2029-06-15') };

  it('finds the coupon period around settlement', () => {
    expect(couponPeriod(bond, d('2026-08-01'))).toEqual({
      previous: d('2026-06-15'),
      next: d('2026-12-15'),
      remaining: 6,
    });
  });

  it('prices at par when yield equals coupon on a coupon date', () => {
    expect(bondCleanPrice(bond, 0.22, d('2026-06-15'))).toBeCloseTo(100, 8);
    expect(accruedInterest(bond, d('2026-06-15'))).toBe(0);
  });

  it('accrues interest through the period', () => {
    // 47 of 183 days of an 11.0 coupon
    expect(accruedInterest(bond, d('2026-08-01'))).toBeCloseTo((11 * 47) / 183, 10);
  });

  it('prices below par when yield is above coupon', () => {
    expect(bondCleanPrice(bond, 0.25, d('2026-08-01'))).toBeLessThan(100);
  });

  it('solves yield from clean price', () => {
    const px = bondCleanPrice(bond, 0.2437, d('2026-08-01'));
    expect(bondYieldFromCleanPrice(bond, px, d('2026-08-01'))).toBeCloseTo(0.2437, 9);
  });

  it('rejects settlement on or after maturity', () => {
    expect(() => couponPeriod(bond, d('2029-06-15'))).toThrow();
  });
});

describe('dates', () => {
  it('clamps month-end when adding months', () => {
    expect(addMonths(d('2026-01-31'), 1)).toEqual(d('2026-02-28'));
    expect(addMonths(d('2028-03-31'), -1)).toEqual(d('2028-02-29'));
  });

  it('skips the Egyptian Friday/Saturday weekend', () => {
    // 2026-09-24 is a Thursday -> next business day is Sunday 27th
    expect(addBusinessDays(d('2026-09-24'), 1)).toEqual(d('2026-09-27'));
    expect(addBusinessDays(d('2026-09-27'), 1)).toEqual(d('2026-09-28'));
  });
});
