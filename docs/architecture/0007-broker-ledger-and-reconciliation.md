# ADR 0007: Broker Ledger, Client Money & Reconciliation

## Status

Accepted

## Context

Brokers are licensed to keep their clients' books and records. Client cash
sits in the broker's **segregated client-money account** at a bank (not with
Agyal). Securities sit with the custodian under the client's unified code
(ADR 0006). The broker needs an accurate, auditable record of each client's
cash and positions, reconciled against the bank account statement, bank
trade confirmations and custody statements.

## Decision

### Double-entry, per-tenant ledger

- A proper double-entry ledger per tenant: `LedgerAccount`, `JournalEntry`
  (header: business event, effective date, reference), `Posting` (account,
  debit/credit, amount, currency, instrument). Entries are **append-only**;
  corrections are reversing entries. Every entry must balance.
- Account types (per client unless noted):
  - `CLIENT_CASH_AVAILABLE`, `CLIENT_CASH_RESERVED` (earmarked for a pending
    order), `CLIENT_POSITION` (per instrument, in nominal/face value),
  - broker-level: `CLIENT_MONEY_BANK` (mirror of the segregated account),
    `BROKER_FEES_RECEIVABLE`, `BROKER_REVENUE`, `SETTLEMENT_PAYABLE` per bank.
- Amounts are stored as integer minor units (piastres) or fixed-precision
  decimals; never floating point. EGP only in Phase 1; currency is on every
  posting so USD instruments can come later.

### Business events → postings

| Event | Postings (simplified) |
| --- | --- |
| Client deposit confirmed on the segregated account | CLIENT_MONEY_BANK ↔ CLIENT_CASH_AVAILABLE |
| Order accepted | move cash AVAILABLE → RESERVED (price × qty + accrued + fees, with buffer) |
| Execution (fill) | RESERVED → SETTLEMENT_PAYABLE (bank); position booked as *pending settlement* |
| Sell order accepted | move nominal CLIENT_POSITION → CLIENT_POSITION_RESERVED |
| Sell fill | CLIENT_POSITION_RESERVED ↔ CUSTODY_POSITION (nominal); SETTLEMENT_RECEIVABLE (bank) ↔ CLIENT_CASH_AVAILABLE (net proceeds) and BROKER_REVENUE (markup + commission) |
| Order finished | unused cash reserve or unsold nominal returned to available |
| Buy settled (ops confirm against bank statement) | SETTLEMENT_PAYABLE (bank) ↔ CLIENT_MONEY_BANK |
| Sell settled | CLIENT_MONEY_BANK ↔ SETTLEMENT_RECEIVABLE (bank) |
| Coupon / maturity received | CLIENT_MONEY_BANK ↔ CLIENT_CASH_AVAILABLE; position closed at maturity |
| Withdrawal requested | CLIENT_CASH_AVAILABLE → CLIENT_CASH_PENDING_WITHDRAWAL |
| Withdrawal paid (or rejected) | CLIENT_CASH_PENDING_WITHDRAWAL ↔ CLIENT_MONEY_BANK (or back to available) |
| Revenue sweep (markup + commission leave the segregated account) | BROKER_REVENUE ↔ CLIENT_MONEY_BANK |

- Sale proceeds are credited to the client's available cash at fill, while
  the bank's payment is tracked as SETTLEMENT_RECEIVABLE until settlement.
  A client can reinvest them immediately, but **withdrawable cash** is
  available cash minus sale proceeds of orders not yet settled.
- Settlement is confirmed per order by broker operations against the bank
  statement (idempotent; the amount is the sum of the bank-side amounts of
  the fills). Automatic confirmation from bank statement files or FIX
  confirmations is a later step.
- After settlements and a revenue sweep, CLIENT_MONEY_BANK equals exactly the
  cash owed to clients (available + reserved + pending withdrawal); the
  end-to-end test asserts this.
- Settlement convention is configured per instrument type and bank
  (e.g. same-day or T+n); the platform tracks trade date and settlement date
  separately and projects positions on both bases.
- Coupon schedules, day-count conventions and accrued interest are computed
  by a shared `fixed-income` calculation package, with results cross-checked
  against the bank's figures on each execution.

### Cash movements

- Phase 1: deposits are identified by a **unique client reference** that the
  client puts on their transfer (or a virtual IBAN if the broker's bank
  offers it). Broker ops confirm deposits from the bank statement
  (upload/import) in the console; the platform proposes matches.
- Withdrawals go only to a bank account in the client's own name (Egyptian
  IBAN, mod-97 checked, holder name must match). Adding the account and
  requesting a withdrawal each require an SMS step-up code. Broker finance
  approves; a **different** user transfers the money and records the bank
  reference (maker-checker, enforced by the API). Every step is audited.
- Direct payment-rail integrations (InstaPay, bank APIs, card acquiring) are
  deferred; they plug into the same events.

### Reconciliation

Daily, per tenant:

1. **Cash**: ledger `CLIENT_MONEY_BANK` vs. the segregated account statement.
2. **Trades**: platform executions vs. bank confirmations/statements.
3. **Positions**: client positions vs. custodian/MCDR (and CBE/bank for
   T-bills) holding statements.

Breaks are listed in the broker console with suggested causes, and must be
resolved or explained; unresolved breaks age and escalate.

## Consequences

- The ledger is the broker's books and records, so it is exportable
  (statements per client, trial balance, FRA reports) and never mutable.
- The platform never holds or moves money itself, consistent with ADR 0001.
- Correctness here matters more than speed; ledger code is covered by
  property-based tests (every entry balances, no negative available cash).
