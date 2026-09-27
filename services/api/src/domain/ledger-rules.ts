import Decimal from 'decimal.js';

/**
 * Double-entry ledger rules for the broker's books (ADR 0007).
 *
 * Amounts are signed: debit positive, credit negative. Each journal entry must
 * sum to zero per unit (a currency such as EGP, or an ISIN for nominal
 * positions). Liability accounts (what the broker owes clients or banks) have
 * credit balances, so their display balance is the negated sum.
 */

export enum LedgerAccountType {
  /** Asset: mirror of the broker's segregated client-money bank account */
  CLIENT_MONEY_BANK = 'CLIENT_MONEY_BANK',
  /** Liability: client cash free to use */
  CLIENT_CASH_AVAILABLE = 'CLIENT_CASH_AVAILABLE',
  /** Liability: client cash earmarked for open orders */
  CLIENT_CASH_RESERVED = 'CLIENT_CASH_RESERVED',
  /** Liability: amount owed to a bank for executed buys until settlement */
  SETTLEMENT_PAYABLE = 'SETTLEMENT_PAYABLE',
  /** Asset: amount a bank owes for executed sells until settlement */
  SETTLEMENT_RECEIVABLE = 'SETTLEMENT_RECEIVABLE',
  /** Liability/equity: broker markup and commission earned */
  BROKER_REVENUE = 'BROKER_REVENUE',
  /** Liability (nominal): securities held for a client, free to sell */
  CLIENT_POSITION = 'CLIENT_POSITION',
  /** Liability (nominal): client securities earmarked for open sell orders */
  CLIENT_POSITION_RESERVED = 'CLIENT_POSITION_RESERVED',
  /** Asset (nominal): securities at the custodian for the broker's clients */
  CUSTODY_POSITION = 'CUSTODY_POSITION',
}

const CREDIT_NORMAL = new Set<LedgerAccountType>([
  LedgerAccountType.CLIENT_CASH_AVAILABLE,
  LedgerAccountType.CLIENT_CASH_RESERVED,
  LedgerAccountType.SETTLEMENT_PAYABLE,
  LedgerAccountType.BROKER_REVENUE,
  LedgerAccountType.CLIENT_POSITION,
  LedgerAccountType.CLIENT_POSITION_RESERVED,
]);

/** Converts a raw signed sum into the natural (usually positive) balance. */
export function displayBalance(type: LedgerAccountType, rawSum: Decimal.Value): Decimal {
  const sum = new Decimal(rawSum);
  return CREDIT_NORMAL.has(type) ? sum.neg() : sum;
}

export interface AccountRef {
  type: LedgerAccountType;
  /** Currency code or ISIN */
  unit: string;
  clientId?: string;
  bankId?: string;
}

export interface PostingLine {
  account: AccountRef;
  amount: Decimal;
}

export function accountKey(tenantId: string, a: AccountRef): string {
  return [tenantId, a.clientId ?? '-', a.type, a.unit, a.bankId ?? '-'].join('|');
}

/** Throws unless the lines sum to zero for every unit. Drops zero lines. */
export function validateEntry(lines: PostingLine[]): PostingLine[] {
  const totals = new Map<string, Decimal>();
  for (const l of lines) {
    totals.set(l.account.unit, (totals.get(l.account.unit) ?? new Decimal(0)).plus(l.amount));
  }
  for (const [unit, total] of totals) {
    if (!total.isZero()) throw new Error(`Unbalanced journal entry: ${unit} sums to ${total}`);
  }
  const nonZero = lines.filter((l) => !l.amount.isZero());
  if (nonZero.length === 0) throw new Error('Empty journal entry');
  return nonZero;
}

const EGP = 'EGP';

const cash = (type: LedgerAccountType, clientId?: string, bankId?: string): AccountRef => ({
  type,
  unit: EGP,
  clientId,
  bankId,
});

/** Client money received on the broker's segregated account. */
export function depositEntry(clientId: string, amount: Decimal.Value): PostingLine[] {
  const a = new Decimal(amount);
  if (!a.gt(0)) throw new Error('Deposit must be positive');
  return validateEntry([
    { account: cash(LedgerAccountType.CLIENT_MONEY_BANK), amount: a },
    { account: cash(LedgerAccountType.CLIENT_CASH_AVAILABLE, clientId), amount: a.neg() },
  ]);
}

/** Earmark client cash for an accepted order. */
export function reserveEntry(clientId: string, amount: Decimal.Value): PostingLine[] {
  const a = new Decimal(amount);
  return validateEntry([
    { account: cash(LedgerAccountType.CLIENT_CASH_AVAILABLE, clientId), amount: a },
    { account: cash(LedgerAccountType.CLIENT_CASH_RESERVED, clientId), amount: a.neg() },
  ]);
}

/** Return unused reserved cash to available (order finished). */
export function releaseEntry(clientId: string, amount: Decimal.Value): PostingLine[] {
  return reserveEntry(clientId, new Decimal(amount).neg());
}

export interface FillAmounts {
  clientId: string;
  bankId: string;
  isin: string;
  /** Nominal filled */
  quantity: Decimal.Value;
  /** Buy: what the client pays for this fill. Sell: net proceeds credited to the client. */
  clientTotal: Decimal.Value;
  /** Buy: owed to the bank. Sell: owed by the bank (principal at bank price + accrued). */
  bankTotal: Decimal.Value;
}

/** A buy fill: consume reserved cash, owe the bank, book revenue and the position. */
export function buyFillEntry(f: FillAmounts): PostingLine[] {
  const clientTotal = new Decimal(f.clientTotal);
  const bankTotal = new Decimal(f.bankTotal);
  const qty = new Decimal(f.quantity);
  return validateEntry([
    { account: cash(LedgerAccountType.CLIENT_CASH_RESERVED, f.clientId), amount: clientTotal },
    { account: cash(LedgerAccountType.SETTLEMENT_PAYABLE, undefined, f.bankId), amount: bankTotal.neg() },
    { account: cash(LedgerAccountType.BROKER_REVENUE), amount: bankTotal.minus(clientTotal) },
    {
      account: { type: LedgerAccountType.CLIENT_POSITION, unit: f.isin, clientId: f.clientId },
      amount: qty.neg(),
    },
    { account: { type: LedgerAccountType.CUSTODY_POSITION, unit: f.isin }, amount: qty },
  ]);
}

const position = (type: LedgerAccountType, isin: string, clientId?: string): AccountRef => ({
  type,
  unit: isin,
  clientId,
});

/** Earmark client securities for an accepted sell order. */
export function positionReserveEntry(clientId: string, isin: string, quantity: Decimal.Value): PostingLine[] {
  const q = new Decimal(quantity);
  return validateEntry([
    { account: position(LedgerAccountType.CLIENT_POSITION, isin, clientId), amount: q },
    { account: position(LedgerAccountType.CLIENT_POSITION_RESERVED, isin, clientId), amount: q.neg() },
  ]);
}

/** Return unsold reserved securities to the client's free position. */
export function positionReleaseEntry(clientId: string, isin: string, quantity: Decimal.Value): PostingLine[] {
  return positionReserveEntry(clientId, isin, new Decimal(quantity).neg());
}

/**
 * A sell fill: deliver the reserved securities, the bank owes the broker,
 * the client is credited net proceeds, and the broker keeps the difference.
 */
export function sellFillEntry(f: FillAmounts): PostingLine[] {
  const clientTotal = new Decimal(f.clientTotal);
  const bankTotal = new Decimal(f.bankTotal);
  const qty = new Decimal(f.quantity);
  return validateEntry([
    { account: cash(LedgerAccountType.SETTLEMENT_RECEIVABLE, undefined, f.bankId), amount: bankTotal },
    { account: cash(LedgerAccountType.CLIENT_CASH_AVAILABLE, f.clientId), amount: clientTotal.neg() },
    { account: cash(LedgerAccountType.BROKER_REVENUE), amount: clientTotal.minus(bankTotal) },
    { account: position(LedgerAccountType.CLIENT_POSITION_RESERVED, f.isin, f.clientId), amount: qty },
    { account: position(LedgerAccountType.CUSTODY_POSITION, f.isin), amount: qty.neg() },
  ]);
}
