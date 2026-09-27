import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { billRedemptionTax, commissionFor, nominalForAmount, projectHolding } from '../../src/domain/projection';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const rule = { markupBps: 25, commissionBps: 10, commissionMin: '25.00' };

describe('projection: T-bill held to maturity', () => {
  const bill = { type: 'TREASURY_BILL' as const, couponRate: null, couponFreq: null, maturityDate: d('2026-12-27') };
  const p = projectHolding({ instrument: bill, settlDate: d('2026-09-28'), clientYield: 0.25, nominal: '100000', rule, taxRate: 0.2 });

  it('prices from the yield and adds commission', () => {
    expect(p.termDays).toBe(90);
    expect(p.clientCleanPx).toBe('94.193548');
    expect(p.principal).toBe('94193.55');
    expect(p.accruedInterest).toBe('0.00');
    expect(p.commission).toBe('100.00');
    expect(p.totalCost).toBe('94293.55');
  });

  it('taxes the discount at maturity and reports the net return', () => {
    expect(p.payments).toHaveLength(1);
    expect(p.payments[0]).toMatchObject({ type: 'REDEMPTION', gross: '100000.00', interest: '5806.45', tax: '1161.29', net: '98838.71' });
    expect(p.totalTax).toBe('1161.29');
    expect(p.priceGain).toBe('0.00');
    expect(p.netProfit).toBe('4545.16');
    expect(Number(p.netAnnualReturn)).toBeCloseTo(0.195487, 5);
  });
});

describe('projection: coupon bond', () => {
  const bond = { type: 'TREASURY_BOND' as const, couponRate: 0.24, couponFreq: 2, maturityDate: d('2027-03-15') };
  const p = projectHolding({ instrument: bond, settlDate: d('2026-09-28'), clientYield: 0.24, nominal: '100000', rule, taxRate: 0.2 });

  it('charges accrued interest since the last coupon', () => {
    expect(p.accruedInterest).toBe('861.88'); // 12 x 13/181 per 100
  });

  it('lists the remaining coupon and redemption with tax on the coupon only', () => {
    expect(p.payments.map((x) => [x.type, x.paymentDate.toISOString().slice(0, 10), x.gross, x.tax])).toEqual([
      ['COUPON', '2027-03-15', '12000.00', '2400.00'],
      ['REDEMPTION', '2027-03-15', '100000.00', '0.00'],
    ]);
    expect(p.totalReceivedNet).toBe('109600.00');
    expect(p.priceGain).toBe(new Decimal(100000).minus(p.principal).toFixed(2));
    expect(new Decimal(p.netProfit).toFixed(2)).toBe(new Decimal('109600').minus(p.totalCost).toFixed(2));
  });

  it('skips a coupon paid on the settlement date', () => {
    const q = projectHolding({ instrument: bond, settlDate: d('2026-09-15'), clientYield: 0.24, nominal: '1000', rule, taxRate: 0 });
    expect(q.payments.filter((x) => x.type === 'COUPON')).toHaveLength(1);
  });
});

describe('projection helpers', () => {
  it('applies the minimum commission', () => {
    expect(commissionFor('10000', rule).toFixed(2)).toBe('25.00');
    expect(commissionFor('1000000', rule).toFixed(2)).toBe('1000.00');
  });

  it('fits the nominal into an amount including commission', () => {
    const n = nominalForAmount('100000', 94.193548, rule, '1000', '1000')!;
    expect(n.toFixed(0)).toBe('106000');
    expect(n.mul(94.193548).div(100).plus(commissionFor(n, rule)).lte(100000)).toBe(true);
    expect(nominalForAmount('500', 94.19, rule, '1000', '1000')).toBeNull();
  });

  it('taxes a T-bill redemption on the discount the client earned', () => {
    expect(billRedemptionTax('100000', '94.193548', 0.2).toFixed(2)).toBe('1161.29');
    expect(billRedemptionTax('1000', '101', 0.2).toFixed(2)).toBe('0.00');
  });

  it('rejects impossible inputs', () => {
    const bill = { type: 'TREASURY_BILL' as const, couponRate: null, couponFreq: null, maturityDate: d('2026-09-01') };
    expect(() => projectHolding({ instrument: bill, settlDate: d('2026-09-28'), clientYield: 0.2, nominal: '1', rule, taxRate: 0.2 })).toThrow();
  });
});
