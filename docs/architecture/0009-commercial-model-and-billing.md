# ADR 0009: Commercial Model & Billing

## Status

Proposed. Tiers are a starting point; the data model supports changing them.

## Context

The target brokers often lack technology budgets and some are struggling
commercially. A high upfront or fixed fee would block adoption. At the same
time Agyal needs revenue that grows with usage and covers hosting, bank
connectivity and support. Agyal is not licensed (ADR 0001), so it must not
share in client commissions in a way that could be treated as an unlicensed
intermediary taking fees from client money.

## Decision

### Tiers

| Tier | Fixed fee | Usage fee | Intended for |
| --- | --- | --- | --- |
| **Growth** (default) | None; setup free | Higher per-trade **technology fee** (bps of nominal traded), with a modest monthly minimum after a ramp-up period (e.g. 6 months) | Small brokers starting fixed income |
| **Scale** | Monthly/annual subscription | Low per-trade technology fee | Brokers with steady volume who want predictable cost |
| **Enterprise** | Negotiated | Negotiated; dedicated database/infra option | Large brokers |

Extras priced separately if needed: custom domain setup, additional bank FIX
sessions, eKYC/AML vendor pass-through costs, native mobile app (later).

### How it is charged

- Agyal invoices the **broker** monthly for software use. The usage fee is
  computed from executed nominal (a technology/service fee), **not** as a
  percentage of the broker's commission or client fees. Economically it can
  track the broker's revenue, but legally it is a software service fee.
- Agyal never deducts fees from client money or from the segregated account.
- The billing module records `Plan`, `Subscription` (tenant, plan, start,
  ramp-up end, minimum), `UsageRecord` (per execution: nominal, bps, fee) and
  `Invoice`. Plans are data, so tiers and rates change without code changes.
- Brokers see their usage and projected invoice in the broker console.

## Consequences

- Growth tier removes the adoption barrier; the ramp-up minimum protects
  Agyal from tenants that onboard but never trade.
- Revenue depends on bank connectivity and liquidity actually producing
  trades, so the early focus is on the first few banks and brokers.
- **Legal check required** before launch: confirm that a usage-based
  technology fee from an unlicensed provider to a broker is acceptable to the
  FRA, and how it must be disclosed (see open questions).
