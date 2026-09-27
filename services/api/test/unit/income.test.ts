import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { entitlementAmount, eventKey, incomeSchedule, withholding } from '../../src/domain/income';
import { incomeReceivedEntry, LedgerAccountType as T } from '../../src/domain/ledger-rules';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('income schedule', () => {
  const bond = { type: 'TREASURY_BOND', couponRate: 0.24, couponFreq: 2, maturityDate: d('2027-03-15') };

  it('lists coupons in the window and the final coupon plus redemption at maturity', () => {
    expect(incomeSchedule(bond, d('2026-09-01'), d('2027-12-31'))).toEqual([
      { type: 'COUPON', paymentDate: d('2026-09-15'), per100: 12 },
      { type: 'COUPON', paymentDate: d('2027-03-15'), per100: 12 },
      { type: 'REDEMPTION', paymentDate: d('2027-03-15'), per100: 100 },
    ]);
  });

  it('pays only face value at maturity for T-bills', () => {
    const bill = { type: 'TREASURY_BILL', couponRate: null, couponFreq: null, maturityDate: d('2026-12-27') };
    expect(incomeSchedule(bill, d('2026-09-27'), d('2026-12-31'))).toEqual([
      { type: 'REDEMPTION', paymentDate: d('2026-12-27'), per100: 100 },
    ]);
    expect(incomeSchedule(bill, d('2026-09-27'), d('2026-12-01'))).toEqual([]);
  });

  it('computes amounts, withholding and keys', () => {
    expect(entitlementAmount('5000', 12).toFixed(2)).toBe('600.00');
    expect(entitlementAmount('1000', (100 * 0.26) / 12).toFixed(2)).toBe('21.67');
    expect(withholding('600', 0.2).toFixed(2)).toBe('120.00');
    expect(() => withholding('600', 1)).toThrow();
    expect(eventKey('EGX', 'COUPON', d('2026-09-15'))).toBe('EGX:COUPON:2026-09-15');
  });
});

describe('income ledger entry', () => {
  it('credits net coupons and books withheld tax', () => {
    const lines = incomeReceivedEntry('EGB', [{ clientId: 'c1', gross: '600', tax: '120' }, { clientId: 'c2', gross: '300' }], false);
    const get = (type: T, clientId?: string) =>
      lines.filter((l) => l.account.type === type && l.account.clientId === clientId).reduce((s, l) => s.plus(l.amount), new Decimal(0)).toFixed(2);
    expect(get(T.CLIENT_CASH_AVAILABLE, 'c1')).toBe('-480.00');
    expect(get(T.CLIENT_CASH_AVAILABLE, 'c2')).toBe('-300.00');
    expect(get(T.CLIENT_MONEY_BANK)).toBe('900.00');
    expect(get(T.TAX_WITHHELD_PAYABLE)).toBe('-120.00');
  });

  it('closes positions on redemption', () => {
    const lines = incomeReceivedEntry('EGB', [{ clientId: 'c1', gross: '5000', nominal: '5000' }], true);
    const pos = lines.find((l) => l.account.type === T.CLIENT_POSITION)!;
    const custody = lines.find((l) => l.account.type === T.CUSTODY_POSITION)!;
    expect(pos.amount.toFixed(2)).toBe('5000.00');
    expect(custody.amount.toFixed(2)).toBe('-5000.00');
  });
});
