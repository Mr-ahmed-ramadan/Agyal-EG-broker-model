import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  buyFillEntry,
  depositEntry,
  displayBalance,
  LedgerAccountType as T,
  positionReleaseEntry,
  positionReserveEntry,
  releaseEntry,
  reserveEntry,
  sellFillEntry,
  validateEntry,
  type PostingLine,
} from '../../src/domain/ledger-rules';

/** Applies entries to an in-memory book and returns display balances. */
function book(entries: PostingLine[][]) {
  const sums = new Map<string, { type: T; sum: Decimal }>();
  for (const lines of entries) {
    for (const l of lines) {
      const k = `${l.account.type}|${l.account.unit}|${l.account.clientId ?? ''}|${l.account.bankId ?? ''}`;
      const cur = sums.get(k) ?? { type: l.account.type, sum: new Decimal(0) };
      cur.sum = cur.sum.plus(l.amount);
      sums.set(k, cur);
    }
  }
  const bal = (type: T, unit = 'EGP', clientId = '', bankId = '') =>
    displayBalance(type, sums.get(`${type}|${unit}|${clientId}|${bankId}`)?.sum ?? 0).toFixed(2);
  return { bal, sums };
}

describe('ledger rules', () => {
  it('rejects unbalanced entries', () => {
    expect(() =>
      validateEntry([
        { account: { type: T.CLIENT_MONEY_BANK, unit: 'EGP' }, amount: new Decimal(10) },
        { account: { type: T.CLIENT_CASH_AVAILABLE, unit: 'EGP', clientId: 'c' }, amount: new Decimal(-9) },
      ]),
    ).toThrow(/Unbalanced/);
  });

  it('keeps cash and positions balanced through deposit, order, fill and release', () => {
    const entries = [
      depositEntry('c1', '100000'),
      reserveEntry('c1', '95200.00'),
      buyFillEntry({
        clientId: 'c1',
        bankId: 'b1',
        isin: 'EGT91DEMO012',
        quantity: '100000',
        clientTotal: '95100.00',
        bankTotal: '94900.00',
      }),
      releaseEntry('c1', '100.00'),
    ];
    const { bal, sums } = book(entries);

    expect(bal(T.CLIENT_MONEY_BANK)).toBe('100000.00');
    expect(bal(T.CLIENT_CASH_AVAILABLE, 'EGP', 'c1')).toBe('4900.00');
    expect(bal(T.CLIENT_CASH_RESERVED, 'EGP', 'c1')).toBe('0.00');
    expect(bal(T.SETTLEMENT_PAYABLE, 'EGP', '', 'b1')).toBe('94900.00');
    expect(bal(T.BROKER_REVENUE)).toBe('200.00');
    expect(bal(T.CLIENT_POSITION, 'EGT91DEMO012', 'c1')).toBe('100000.00');

    // Trial balance: every unit nets to zero.
    const perUnit = new Map<string, Decimal>();
    for (const [k, v] of sums) {
      const unit = k.split('|')[1];
      perUnit.set(unit, (perUnit.get(unit) ?? new Decimal(0)).plus(v.sum));
    }
    for (const total of perUnit.values()) expect(total.isZero()).toBe(true);
  });

  it('rejects a non-positive deposit', () => {
    expect(() => depositEntry('c1', '0')).toThrow();
  });

  it('keeps the book balanced through a partial sale and release of the rest', () => {
    const isin = 'EGT91DEMO012';
    const entries = [
      depositEntry('c1', '100000'),
      reserveEntry('c1', '95100.00'),
      buyFillEntry({ clientId: 'c1', bankId: 'b1', isin, quantity: '100000', clientTotal: '95100.00', bankTotal: '94900.00' }),
      positionReserveEntry('c1', isin, '100000'),
      sellFillEntry({ clientId: 'c1', bankId: 'b1', isin, quantity: '60000', clientTotal: '57300.00', bankTotal: '57450.00' }),
      positionReleaseEntry('c1', isin, '40000'),
    ];
    const { bal, sums } = book(entries);
    expect(bal(T.CLIENT_POSITION, isin, 'c1')).toBe('40000.00');
    expect(bal(T.CLIENT_POSITION_RESERVED, isin, 'c1')).toBe('0.00');
    expect(bal(T.CUSTODY_POSITION, isin)).toBe('40000.00');
    expect(bal(T.CLIENT_CASH_AVAILABLE, 'EGP', 'c1')).toBe((4900 + 57300).toFixed(2));
    expect(bal(T.SETTLEMENT_RECEIVABLE, 'EGP', '', 'b1')).toBe('57450.00');
    expect(bal(T.BROKER_REVENUE)).toBe((200 + 150).toFixed(2));
    const perUnit = new Map<string, Decimal>();
    for (const [k, v] of sums) perUnit.set(k.split('|')[1], (perUnit.get(k.split('|')[1]) ?? new Decimal(0)).plus(v.sum));
    for (const total of perUnit.values()) expect(total.isZero()).toBe(true);
  });
});
