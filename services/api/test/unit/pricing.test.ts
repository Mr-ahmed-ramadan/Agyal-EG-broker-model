import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { tbillPriceFromYield } from '../../src/domain/fixed-income';
import { priceClientBuy, resolvePricingRule, type PricingConfig } from '../../src/domain/pricing';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

const config: PricingConfig = {
  default: { markupBps: 50, commissionBps: 10, commissionMin: '25.00' },
  byInstrumentType: { TREASURY_BILL: { markupBps: 25 } },
  maxMarkupBps: 300,
};

describe('pricing rules', () => {
  it('applies instrument-type overrides over the default', () => {
    expect(resolvePricingRule(config, 'TREASURY_BILL')).toEqual({
      markupBps: 25,
      commissionBps: 10,
      commissionMin: '25.00',
    });
    expect(resolvePricingRule(config, 'SUKUK').markupBps).toBe(50);
  });

  it('refuses markups above the guardrail', () => {
    expect(() =>
      resolvePricingRule({ ...config, byInstrumentType: { SUKUK: { markupBps: 400 } } }, 'SUKUK'),
    ).toThrow(/outside allowed range/);
  });
});

describe('client buy pricing', () => {
  const settle = d('2026-03-01');
  const maturity = d('2026-06-01');

  it('gives a T-bill client a lower yield and higher price than the bank', () => {
    const bankPx = tbillPriceFromYield(0.26, settle, maturity);
    const p = priceClientBuy({
      instrument: { type: 'TREASURY_BILL', couponRate: null, couponFreq: null, maturityDate: maturity },
      bankCleanPx: bankPx,
      quantity: '100000',
      settlDate: settle,
      rule: resolvePricingRule(config, 'TREASURY_BILL'),
    });
    expect(Number(p.bankYield)).toBeCloseTo(0.26, 6);
    expect(Number(p.clientYield)).toBeCloseTo(0.2575, 6);
    expect(Number(p.clientCleanPx)).toBeGreaterThan(bankPx);
    expect(p.accruedInterest).toBe('0.00');
    expect(p.commission).toBe('100.00'); // 10 bps of 100,000
    expect(new Decimal(p.principal).plus(p.accruedInterest).plus(p.commission).toFixed(2)).toBe(p.totalCost);
  });

  it('applies the minimum commission and accrued interest on a bond', () => {
    const p = priceClientBuy({
      instrument: { type: 'TREASURY_BOND', couponRate: 0.22, couponFreq: 2, maturityDate: d('2029-06-15') },
      bankCleanPx: 98.5,
      quantity: '5000',
      settlDate: d('2026-08-01'),
      rule: resolvePricingRule(config, 'TREASURY_BOND'),
    });
    expect(p.commission).toBe('25.00');
    expect(Number(p.accruedInterest)).toBeCloseTo((5000 * (11 * 47)) / 183 / 100, 2);
    expect(Number(p.clientYield)).toBeCloseTo(Number(p.bankYield) - 0.005, 6);
    expect(Number(p.clientCleanPx)).toBeGreaterThan(98.5);
  });

  it('rejects a non-positive quantity', () => {
    expect(() =>
      priceClientBuy({
        instrument: { type: 'TREASURY_BILL', couponRate: null, couponFreq: null, maturityDate: maturity },
        bankCleanPx: 95,
        quantity: '0',
        settlDate: settle,
        rule: config.default,
      }),
    ).toThrow();
  });
});
