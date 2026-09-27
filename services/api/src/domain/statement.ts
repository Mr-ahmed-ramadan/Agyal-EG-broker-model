import Decimal from 'decimal.js';

/**
 * Client statement lines from ledger journal entries (ADR 0007).
 *
 * A client's cash is the sum of their available, reserved and
 * pending-withdrawal accounts, so reservations (moves between those accounts)
 * net to zero and don't appear; only money in or out of the client does.
 */

export type StatementKind = 'DEPOSIT' | 'BUY' | 'SELL' | 'COUPON' | 'REDEMPTION' | 'WITHDRAWAL' | 'OTHER';

const KIND: Record<string, StatementKind> = {
  DEPOSIT: 'DEPOSIT',
  BUY_FILL: 'BUY',
  SELL_FILL: 'SELL',
  COUPON_RECEIVED: 'COUPON',
  REDEMPTION_RECEIVED: 'REDEMPTION',
  WITHDRAWAL_PAID: 'WITHDRAWAL',
};

export interface StatementEntry {
  journalEntryId: string;
  eventType: string;
  reference: string;
  date: Date;
  /** Change in the client's total cash (positive = money in) */
  cash: Decimal;
  /** Change in the client's holdings, by ISIN (positive = nominal in) */
  positions: Map<string, Decimal>;
}

export interface StatementLine {
  journalEntryId: string;
  kind: StatementKind;
  eventType: string;
  reference: string;
  date: Date;
  isin: string | null;
  nominal: string | null;
  amount: string;
  balance: string;
}

export interface StatementTotals {
  deposits: string;
  withdrawals: string;
  bought: string;
  sold: string;
  /** Coupons, net of tax */
  income: string;
  /** Face value repaid at maturity, net of tax */
  matured: string;
}

export function statementKind(eventType: string): StatementKind {
  return KIND[eventType] ?? 'OTHER';
}

/** Lines in date order with a running cash balance; entries that move nothing are dropped. */
export function statementLines(opening: Decimal.Value, entries: StatementEntry[]): { lines: StatementLine[]; closing: Decimal; totals: StatementTotals } {
  let balance = new Decimal(opening);
  const t = { deposits: new Decimal(0), withdrawals: new Decimal(0), bought: new Decimal(0), sold: new Decimal(0), income: new Decimal(0), matured: new Decimal(0) };
  const lines: StatementLine[] = [];
  for (const e of [...entries].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const moved = [...e.positions].filter(([, n]) => !n.isZero());
    if (e.cash.isZero() && moved.length === 0) continue;
    balance = balance.plus(e.cash);
    const kind = statementKind(e.eventType);
    if (kind === 'DEPOSIT') t.deposits = t.deposits.plus(e.cash);
    else if (kind === 'WITHDRAWAL') t.withdrawals = t.withdrawals.minus(e.cash);
    else if (kind === 'BUY') t.bought = t.bought.minus(e.cash);
    else if (kind === 'SELL') t.sold = t.sold.plus(e.cash);
    else if (kind === 'COUPON') t.income = t.income.plus(e.cash);
    else if (kind === 'REDEMPTION') t.matured = t.matured.plus(e.cash);
    const [isin, nominal] = moved[0] ?? [null, null];
    lines.push({
      journalEntryId: e.journalEntryId,
      kind,
      eventType: e.eventType,
      reference: e.reference,
      date: e.date,
      isin,
      nominal: nominal ? nominal.toFixed(2) : null,
      amount: e.cash.toFixed(2),
      balance: balance.toFixed(2),
    });
  }
  const f = (d: Decimal) => d.toFixed(2);
  return {
    lines,
    closing: balance,
    totals: { deposits: f(t.deposits), withdrawals: f(t.withdrawals), bought: f(t.bought), sold: f(t.sold), income: f(t.income), matured: f(t.matured) },
  };
}
