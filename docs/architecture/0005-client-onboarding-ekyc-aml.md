# ADR 0005: Client Onboarding — eKYC, AML & Broker Approval

## Status

Accepted

## Context

Clients must be able to open an account fully online: identity verified
electronically, screened for money-laundering and sanctions risk, assessed
for suitability, and approved by the broker, which is the regulated party
(ADR 0001). Relevant rules include the Capital Market Law and FRA decrees on
digital onboarding / e-KYC for non-bank financial activities, the AML Law
(80/2002) and EMLCU guidance, and the Personal Data Protection Law
(151/2020). Exact decree references are confirmed with the brokers'
compliance officers (see open questions).

## Decision

### Wizard steps

`ACCOUNT → IDENTITY → PROFILE (CDD) → AML → SUITABILITY → BANK_ACCOUNT →
UNIFIED_CODE → CONSENTS → SUBMITTED → (APPROVED | NEEDS_INFO | REJECTED)`

1. **Account**: mobile (OTP) and email (link) verified; password + device.
2. **Identity (eKYC)**: national ID front/back capture, OCR of the 14-digit
   national ID number, liveness check and face match, behind a
   vendor-agnostic `EkycProvider` interface. A mock provider ships for
   development; a real Egyptian eKYC vendor is chosen per contract (open
   question) and may differ per broker. The national ID is stored encrypted
   (per-tenant key, ADR 0002); only the last 4 digits are shown in UIs.
3. **Profile / CDD**: address, occupation, employer, income band, source of
   funds and wealth, expected activity, PEP self-declaration, tax
   residency (FATCA/CRS self-certification).
4. **AML screening**: `AmlScreeningProvider` screens name + DOB + national ID
   against sanctions, PEP and local lists; result is a `RiskRating` (LOW /
   MEDIUM / HIGH) plus hit details. Re-screened on list updates and on the
   broker's periodic review cycle.
5. **Suitability**: scored questionnaire → `RiskProfile`; optional
   qualified-investor declaration → `InvestorCategory`. Drives which
   instruments the client may buy (e.g. corporate bonds/sukuk may require a
   higher profile; configurable per broker).
6. **Bank account**: the client's own bank account (IBAN) for withdrawals;
   name match checked where possible.
7. **Unified code**: capture an existing MCDR unified code or request a new
   one (ADR 0006).
8. **Consents**: broker terms, risk disclosure, privacy notice (PDPL),
   e-signature of the account-opening agreement; stored versioned with
   timestamp, IP and document hash in an append-only table.

### Decision engine and broker approval

- Each broker configures **auto-approval rules** (e.g. eKYC PASS, liveness
  score above a threshold, AML LOW, no PEP, suitability complete). Clean
  applications matching the rules are approved automatically **in the
  broker's name**, and the rule version used is recorded.
- Anything else goes to the broker's **compliance queue** in the broker
  console: view evidence, request more information (client returns to the
  wizard with a message), approve, or reject. Every action is attributed to a
  named broker user; high-risk approvals can require a second approver.
- A client can browse prices before approval but cannot trade until status is
  `ACTIVE` **and** a unified code is linked (ADR 0006).

### Ongoing obligations

- KYC expiry and periodic review dates per risk rating; expired clients are
  blocked from buying (selling/redemption still allowed).
- Suspicious-activity flags from the platform (unusual size, rapid in/out)
  go to the broker's compliance queue; STR filing to EMLCU is the broker's
  action, supported by an evidence export.

## Consequences

- eKYC and AML vendors are replaceable per broker without touching the
  wizard; this matters because brokers may already have vendor contracts.
- All personal data and documents are tenant-scoped and encrypted; retention
  periods follow the broker's record-keeping obligations and PDPL.
- The onboarding record is the broker's KYC file; it must be exportable for
  FRA inspection.
