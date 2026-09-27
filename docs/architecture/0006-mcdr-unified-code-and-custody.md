# ADR 0006: MCDR Unified Code & Custody Linkage

## Status

Proposed. Adapter design accepted; details depend on the open questions below.

## Context

In the Egyptian market, investors are identified at Misr for Central
Clearing, Depository and Registry (MCDR) by a **unified code** (الكود
الموحد). It is issued once per investor and used across market
participants: securities held in the depository are booked under it via the
investor's custodian. A client cannot settle or hold depository-eligible
securities without one.

Things we do not yet know for certain (to confirm with MCDR and brokers):

- Whether every target broker is also a **custodian** (أمين حفظ), or uses a
  third-party custodian (often a bank), and who submits the code request.
- Whether MCDR offers an electronic channel (API, member portal, file) to
  the broker/custodian for code requests and look-ups, and its format.
- How a client who **already has a code** (from another broker) is linked to
  a new custodian account, and what evidence is required.
- Which fixed-income instruments are held at MCDR versus elsewhere. In
  particular, **T-bills may be held in bank custody at the Central Bank of
  Egypt rather than at MCDR**, in which case a T-bill purchase needs the
  client's custody account at the executing bank, not only the unified code.

## Decision

### Model the concept, not the channel

- `InvestorCode` (tenant-scoped): the client's unified code, `status`
  (`NOT_REQUESTED`, `EXISTING_DECLARED`, `REQUESTED`, `ISSUED`, `VERIFIED`,
  `REJECTED`), source, evidence documents, and timestamps.
- `CustodyAccount` (tenant-scoped): where the client's securities sit for a
  given instrument class: custodian (broker or bank), account number, depository
  (`MCDR`, `CBE`, or `BANK_INTERNAL`), linked `InvestorCode`, status.
- An order can only be released when the client has an active
  `CustodyAccount` for the instrument's depository (ADR 0003 pre-trade checks).

### Two onboarding paths

1. **Client already has a code**: they enter it; the platform validates the
   format, and the broker ops/custodian verifies it against MCDR (manually
   in Phase 1) and completes the custody link.
2. **New code**: the platform generates the MCDR application package from the
   onboarding data (pre-filled form, ID images, signed application) and puts
   it in the broker ops queue; the broker (or its custodian) submits it and
   records the issued code.

### `McdrAdapter` interface

```
requestCode(client) -> submissionRef
getStatus(submissionRef) -> status, code?
verifyCode(code, nationalId) -> match | mismatch | unknown
linkCustodyAccount(code, custodian, account) -> status
```

- **Phase 1: `ManualMcdrAdapter`** — each call becomes a task in the broker
  console (generate package, upload evidence, enter result). Status changes
  notify the client.
- **Later: `ElectronicMcdrAdapter`** — the same interface over whatever
  electronic channel MCDR or the custodian provides. No change to onboarding
  or order management.

### Custody reconciliation

- Holdings reported by custodians/MCDR statements are reconciled per client
  against the platform ledger (ADR 0007); breaks go to the broker ops queue.

### Phase 1 implementation

- `ManualMcdrAdapter` is live: onboarding records a declared or requested
  code, and the broker console's *Unified codes & custody* screen lets broker
  operations record the verified code and the client's custody accounts.
- Pending the answer to M1, demo T-bills are held at `CBE` (via a bank
  custodian) and bonds/sukuk at `MCDR`; the order pre-trade check requires an
  active custody account for the instrument's depository.

## Consequences

- Onboarding completes (client approved) before the code exists; trading is
  unlocked when the custody link is active. The client UI shows this clearly
  ("account approved — custody account being opened").
- The adapter keeps the platform useful before any MCDR integration exists,
  which is likely to take time.
- The T-bill custody question may change the pre-trade checks and the order
  `Parties` group per bank; it is the top item in
  [`open-questions.md`](open-questions.md).
