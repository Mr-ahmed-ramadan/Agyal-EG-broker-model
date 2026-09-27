import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { statementLines, type StatementEntry } from '../../src/domain/statement';

const e = (id: string, eventType: string, day: number, cash: string, positions: [string, string][] = []): StatementEntry => ({
  journalEntryId: id,
  eventType,
  reference: `ref-${id}`,
  date: new Date(Date.UTC(2026, 8, day)),
  cash: new Decimal(cash),
  positions: new Map(positions.map(([i, n]) => [i, new Decimal(n)])),
});

describe('client statement', () => {
  const { lines, closing, totals } = statementLines('1000', [
    e('4', 'COUPON_RECEIVED', 20, '160'),
    e('1', 'DEPOSIT', 1, '100000'),
    e('2', 'ORDER_RESERVE', 2, '0'), // reservation: moves between the client's own cash accounts
    e('3', 'BUY_FILL', 3, '-94293.55', [['EGT', '100000']]),
    e('5', 'REDEMPTION_RECEIVED', 25, '98838.71', [['EGT', '-100000']]),
    e('6', 'WITHDRAWAL_PAID', 26, '-5000'),
  ]);

  it('orders lines by date, keeps a running balance and drops reservations', () => {
    expect(lines.map((l) => [l.kind, l.amount, l.balance])).toEqual([
      ['DEPOSIT', '100000.00', '101000.00'],
      ['BUY', '-94293.55', '6706.45'],
      ['COUPON', '160.00', '6866.45'],
      ['REDEMPTION', '98838.71', '105705.16'],
      ['WITHDRAWAL', '-5000.00', '100705.16'],
    ]);
    expect(lines[1]).toMatchObject({ isin: 'EGT', nominal: '100000.00' });
    expect(closing.toFixed(2)).toBe('100705.16');
  });

  it('totals money in and out by kind', () => {
    expect(totals).toEqual({ deposits: '100000.00', withdrawals: '5000.00', bought: '94293.55', sold: '0.00', income: '160.00', matured: '98838.71' });
  });
});
