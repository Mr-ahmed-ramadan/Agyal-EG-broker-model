import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { holderMatchesClient, isValidEgyptianIban, maskIban, normaliseIban } from '../../src/domain/iban';
import {
  buyFillEntry,
  buySettlementEntry,
  depositEntry,
  displayBalance,
  LedgerAccountType as T,
  positionReserveEntry,
  reserveEntry,
  revenueSweepEntry,
  sellFillEntry,
  sellSettlementEntry,
  withdrawableCash,
  withdrawalHoldEntry,
  withdrawalPaidEntry,
  withdrawalReleaseEntry,
  type PostingLine,
} from '../../src/domain/ledger-rules';

function book(entries: PostingLine[][]) {
  const sums = new Map<string, { type: T; sum: Decimal }>();
  for (const l of entries.flat()) {
    const k = `${l.account.type}|${l.account.unit}|${l.account.clientId ?? ''}|${l.account.bankId ?? ''}`;
    const cur = sums.get(k) ?? { type: l.account.type, sum: new Decimal(0) };
    cur.sum = cur.sum.plus(l.amount);
    sums.set(k, cur);
  }
  const bal = (type: T, unit = 'EGP', clientId = '', bankId = '') =>
    displayBalance(type, sums.get(`${type}|${unit}|${clientId}|${bankId}`)?.sum ?? 0).toFixed(2);
  return { bal };
}

describe('closing the cash loop', () => {
  const isin = 'EGT91DEMO012';

  it('clears bank payable/receivable on settlement, pays a withdrawal and sweeps revenue', () => {
    const { bal } = book([
      depositEntry('c1', '100000'),
      reserveEntry('c1', '95100.00'),
      buyFillEntry({ clientId: 'c1', bankId: 'b1', isin, quantity: '100000', clientTotal: '95100.00', bankTotal: '94900.00' }),
      positionReserveEntry('c1', isin, '50000'),
      sellFillEntry({ clientId: 'c1', bankId: 'b1', isin, quantity: '50000', clientTotal: '47400.00', bankTotal: '47550.00' }),
      buySettlementEntry('b1', '94900.00'),
      sellSettlementEntry('b1', '47550.00'),
      withdrawalHoldEntry('c1', '30000'),
      withdrawalPaidEntry('c1', '30000'),
      withdrawalHoldEntry('c1', '1000'),
      withdrawalReleaseEntry('c1', '1000'),
      revenueSweepEntry('350.00'),
    ]);
    expect(bal(T.SETTLEMENT_PAYABLE, 'EGP', '', 'b1')).toBe('0.00');
    expect(bal(T.SETTLEMENT_RECEIVABLE, 'EGP', '', 'b1')).toBe('0.00');
    expect(bal(T.CLIENT_CASH_PENDING_WITHDRAWAL, 'EGP', 'c1')).toBe('0.00');
    expect(bal(T.BROKER_REVENUE)).toBe('0.00');
    // Client cash: 100,000 - 95,100 + 47,400 - 30,000
    expect(bal(T.CLIENT_CASH_AVAILABLE, 'EGP', 'c1')).toBe('22300.00');
    // Segregated account holds exactly the client's money once revenue is swept
    expect(bal(T.CLIENT_MONEY_BANK)).toBe('22300.00');
  });

  it('rejects non-positive amounts', () => {
    expect(() => withdrawalHoldEntry('c1', '0')).toThrow();
    expect(() => buySettlementEntry('b1', '-5')).toThrow();
    expect(() => revenueSweepEntry(0)).toThrow();
  });

  it('keeps unsettled sale proceeds from being withdrawn', () => {
    expect(withdrawableCash('52300.00', '47400.00').toFixed(2)).toBe('4900.00');
    expect(withdrawableCash('1000', '5000').toFixed(2)).toBe('0.00');
  });
});

describe('IBAN', () => {
  it('accepts valid Egyptian IBANs, with or without spaces', () => {
    expect(isValidEgyptianIban('EG380019000500000000263180002')).toBe(true);
    expect(isValidEgyptianIban('eg38 0019 0005 0000 0000 2631 8000 2')).toBe(true);
    expect(normaliseIban('eg38 0019')).toBe('EG380019');
  });

  it('rejects wrong checksums, lengths and countries', () => {
    expect(isValidEgyptianIban('EG380019000500000000263180003')).toBe(false);
    expect(isValidEgyptianIban('EG38001900050000000026318000')).toBe(false);
    expect(isValidEgyptianIban('GB82WEST12345698765432')).toBe(false);
  });

  it('masks and matches holder names', () => {
    expect(maskIban('EG380019000500000000263180002')).toBe('EG38 •••• •••• 0002');
    expect(holderMatchesClient('  nour   HASSAN ', 'Nour Hassan')).toBe(true);
    expect(holderMatchesClient('Someone Else', 'Nour Hassan')).toBe(false);
  });
});
