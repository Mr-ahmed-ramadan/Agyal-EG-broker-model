# ADR 0001: Product Scope & Regulatory Posture

## Status

Accepted

## Context

Many FRA-licensed brokerage firms in Egypt hold the licence to deal in
securities but have no technology to offer fixed income to their retail
clients. Fixed income in Egypt (T-bills, treasury bonds, corporate bonds and
sukuk) trades almost entirely over-the-counter through banks, not on the
exchange order book, so a broker that wants to offer it needs:

- a client-facing channel (onboarding, browsing, ordering, portfolio),
- a way to get prices from and place orders with banks,
- a client ledger and reconciliation against banks and the depository,
- compliance tooling (eKYC, AML, suitability, audit trail).

Agyal Broker Platform provides all of this as a white-label SaaS.

## Decision

**Agyal is a technology provider, not a regulated intermediary.** The broker
is the licensed entity for every client relationship and every trade.

| Concern | Owner |
| --- | --- |
| Client relationship, KYC/AML decision, suitability | Broker (licensed) |
| Client money (segregated client account at a bank) | Broker |
| Client ledger (books and records) | Broker, using the platform's ledger |
| Execution (OTC, one order per client) | Partner bank, on the broker's instruction |
| Custody / unified code | Broker / custodian via MCDR (see ADR 0006) |
| Software, hosting, data processing, uptime | Agyal |

In practice this means:

- Every client-facing surface is branded as the broker, and legal documents
  (terms, risk disclosure, privacy) are the broker's documents. Agyal appears
  only as a technology/data-processor where the law requires disclosure.
- Agyal staff never approve clients, approve orders or move money. Admin
  tooling for Agyal operators is limited to tenant setup, support and
  platform health; access to client personal data is audited and minimised.
- Agyal is paid by the broker for software (see ADR 0009), never by the end
  client and never out of client money.

### Phase scope

**Phase 1 (this build)**

- Multi-tenant, white-label client web app (EN/AR, RTL), broker console,
  Agyal admin console, bank portal for banks without FIX.
- Online onboarding: eKYC, AML screening, suitability, broker compliance queue.
- MCDR unified-code workflow (manual adapter first, see ADR 0006).
- FIX-native order management: RFQ to one or more partner banks, one order
  per client, execution reports, confirmations.
- Per-broker ledger for client cash and positions, reconciliation.
- Instruments: treasury bonds, T-bills, corporate bonds and sukuk.
- Broker pricing (markup/commission) and fee disclosure.

**Deferred**

- Native mobile apps (web app is mobile-first at launch).
- Inbound FIX from brokers' own systems and FIX drop copy (ADR 0003).
- Block orders and allocations.
- Fixed-income funds, securities lending, early-exit liquidity facilities.
- Direct electronic MCDR and payment-rail integrations (ADR 0006, 0007).

## Consequences

- The regulatory footprint of Agyal stays that of a software/outsourcing
  provider. It still needs: a data-processing agreement per broker, hosting
  that satisfies FRA outsourcing and data-residency expectations, and
  PDPL (Law 151/2020) compliance.
- Because the broker owns the decisions, the platform must make every
  decision **attributable** to a named broker user (approve client, release
  order, override price) with an immutable audit log.
- Anything that would make Agyal a principal or a holder of client assets
  (pooling cash, dealing on own account, early-exit buybacks) is out of scope
  unless a separate legal review says otherwise. This is a deliberate
  difference from the original Agyal (`Agyal-eg`) model.
- Open legal questions are tracked in [`open-questions.md`](open-questions.md).
