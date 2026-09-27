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
| Settlement date: cash paid to bank / securities delivered to custody | SETTLEMENT_PAYABLE ↔ CLIENT_MONEY_BANK; position → settled |
| Coupon / maturity received | CLIENT_MONEY_BANK ↔ CLIENT_CASH_AVAILABLE; position closed at maturity |
| Broker fees/commission | CLIENT_CASH → BROKER_FEES_RECEIVABLE |
| Withdrawal to client's own bank account | CLIENT_CASH_AVAILABLE ↔ CLIENT_MONEY_BANK |

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
- Withdrawals are requested by the client, approved by broker ops/finance
  (maker-checker), and executed by the broker in their bank; the platform
  records them and reconciles against the statement.
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
