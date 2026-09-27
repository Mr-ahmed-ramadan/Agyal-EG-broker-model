import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ECONOMICS,
  economicsProblems,
  mergeEconomics,
  pricingRuleFor,
  tenorBucket,
  waterfall,
} from '../../src/domain/economics';

describe('economics waterfall', () => {
  it('reproduces the one-year bond illustration', () => {
    const w = waterfall(DEFAULT_ECONOMICS, 'TREASURY_BOND', 0.255, 365);
    expect(w.clientYield).toBeCloseTo(0.2395, 6); // 25.50 - 0.05 - 0.50 - 1.00
    expect(w.tax).toBeCloseTo(0.0479, 6); // 20% of 23.95
    expect(w.netYield).toBeCloseTo(0.1916, 6);
    expect(w.depositRate).toBe(0.17);
    expect(w.vsDeposit).toBeCloseTo(0.0216, 6);
    expect(w.belowDeposit).toBe(false);
  });

  it('flags a paper whose net falls below the deposit', () => {
    const e = mergeEconomics(DEFAULT_ECONOMICS, { depositRates: { UP_TO_3M: 0.22 } });
    expect(waterfall(e, 'TREASURY_BILL', 0.255, 91).belowDeposit).toBe(true);
    expect(waterfall(e, 'TREASURY_BILL', 0.255, 182).belowDeposit).toBe(false);
  });

  it('buckets terms', () => {
    expect([91, 92, 182, 364, 366, 367, 1095].map(tenorBucket)).toEqual(['UP_TO_3M', 'UP_TO_3M', 'UP_TO_6M', 'UP_TO_1Y', 'UP_TO_1Y', 'OVER_1Y', 'OVER_1Y']);
  });
});

describe('economics settings', () => {
  it('merges broker overrides onto platform defaults', () => {
    const e = mergeEconomics(DEFAULT_ECONOMICS, { brokerMarginBps: 75, taxRates: { SUKUK: 0.1 }, custodyBps: undefined });
    expect(e.brokerMarginBps).toBe(75);
    expect(e.custodyBps).toBe(5);
    expect(e.taxRates.SUKUK).toBe(0.1);
    expect(e.taxRates.TREASURY_BILL).toBe(0.2);
    expect(DEFAULT_ECONOMICS.brokerMarginBps).toBe(50); // defaults untouched
  });

  it('turns economics into a pricing rule with its split', () => {
    expect(pricingRuleFor(DEFAULT_ECONOMICS)).toEqual({
      markupBps: 155,
      commissionBps: 0,
      commissionMin: '0.00',
      split: { custodyBps: 5, brokerMarginBps: 50, platformMarginBps: 100 },
    });
  });

  it('validates', () => {
    expect(economicsProblems(DEFAULT_ECONOMICS)).toEqual([]);
    expect(economicsProblems({ ...DEFAULT_ECONOMICS, platformMarginBps: 400 }).join()).toMatch(/above the 3.00% limit/);
    expect(economicsProblems({ ...DEFAULT_ECONOMICS, brokerMarginBps: -1 }).join()).toMatch(/Broker margin/);
    expect(economicsProblems({ ...DEFAULT_ECONOMICS, taxRates: { ...DEFAULT_ECONOMICS.taxRates, SUKUK: 1 } }).join()).toMatch(/SUKUK/);
  });
});
