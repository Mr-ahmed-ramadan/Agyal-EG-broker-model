# ADR 0008: Pricing, Broker Markup & Fee Disclosure

## Status

Accepted

## Context

Banks quote a price or yield in response to an RFQ (ADR 0003). The broker
earns from the client through a markup on that quote and/or explicit
commission and fees. Clients must see an all-in price and a clear fee
breakdown, and the broker must be able to prove afterwards what the client
was shown and agreed to.

## Decision

### Price formation

```
bank quote (price % of par or yield)
  → broker markup (bps of yield)
  → client price / client yield
  + explicit fees (commission, custody, MCDR/other pass-through charges)
  = client all-in cost, shown before acceptance
```

- **Markup is expressed in yield basis points.** For a buy, the client's yield
  is the bank's yield minus the markup, and the client's clean price is
  recomputed from that yield with the instrument's conventions (T-bills:
  Actual/365 discount; bonds and sukuk: yield to maturity at the coupon
  frequency). This keeps the markup comparable across tenors, where a
  price-based markup would not be. Implemented in
  `services/api/src/domain/pricing.ts`.
- `PricingRule` per tenant: markup in bps and/or commission (flat or bps of
  nominal, with minimum), resolved most-specific-wins across dimensions
  (instrument type, tenor bucket, issuer, client segment, order size band).
  Same resolution pattern as the original Agyal pricing engine, but owned by
  the broker, not the platform.
- When several banks quote, the platform ranks by **client outcome** (best
  all-in yield for a buy) and shows the best one; the broker can configure
  "show best only" or "show all quotes".
- Quotes carry a validity window; client-facing prices are only shown while
  the underlying bank quote is live. **Indicative prices** (for browsing,
  from bank price feeds or the broker's reference table) are always labelled
  as indicative.
- Rounding and day-count follow the instrument's conventions; accrued
  interest is added to the settlement amount for bonds; T-bills are priced
  at a discount from the yield.

### Fee disclosure & snapshots

- On acceptance the platform writes an immutable `PriceSnapshot`: bank quote
  (ID, price/yield, validity), pricing rule version, markup, fees, client
  price/yield, accrued interest, total cost, and the exact disclosure text
  the client saw. The `Order` references it.
- The client confirmation and statement show commission and fees explicitly.
  Whether the markup itself must be disclosed is a broker/legal decision,
  configured per tenant (open question).

### Guardrails

- Per-tenant maximum markup and a warning when the client yield falls below
  a benchmark (e.g. comparable deposit rates), to protect brokers from
  mispricing and conduct risk.
- Manual price overrides by a broker dealer require a reason and, if
  enabled, a second approver.

## Update: yield economics set by Agyal (custody, broker, platform)

The single broker markup is replaced by three yield deductions, each booked
to its own ledger account on every fill:

| Component | Default | Ledger account |
| --- | --- | --- |
| Custody & operations | 5 bps | `CUSTODY_FEE_PAYABLE` |
| Broker margin | 50 bps | `BROKER_REVENUE` |
| Platform (Agyal) margin | 100 bps | `PLATFORM_FEE_PAYABLE` |
| Commission (optional) | 0 | `BROKER_REVENUE` |

- Platform defaults live in `PlatformSetting` (key `economics`); Agyal admins
  can override any field per broker (`Tenant.config.economics`). Guardrail:
  total deduction at most 3.00%.
- The split is frozen in each price snapshot, so a trade keeps the economics
  it was done at; rounding stays with the broker.
- Tax on interest (default 20% per paper type) and bank-deposit rates by term
  are part of the same settings. Clients see a waterfall (market yield → each
  deduction → yield before tax → tax → net → deposit comparison); brokers can
  be set to show only before-tax, tax and net. Deposit interest is compared as
  a net rate because it is generally tax-exempt for individuals in Egypt.
- A paper whose client net yield falls below the same-term deposit is flagged
  in the admin and broker consoles and described neutrally to clients; it is
  not blocked.
- Finance pays each payable out of the segregated account separately
  (broker revenue, Agyal fee, custody).

This supersedes the earlier statement that clients never see the bank price or
markup: the breakdown is shown by default and can be turned off per broker.

## Consequences

- All rate logic lives in the `pricing` module; order management and the UI
  call it rather than computing prices.
- The snapshot table grows with every order; that is the price of a
  complete audit trail.
- Agyal's own platform fee is **not** part of client pricing; it is billed to
  the broker separately (ADR 0009).
