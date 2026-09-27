# ADR 0010: Tech Stack, Security & Deployment

## Status

Accepted

## Context

The platform combines a FIX engine (low-level, session-oriented, must be
rock solid), a business API (onboarding, orders, ledger, pricing, billing)
and four web front ends. It handles financial and personal data for several
regulated brokers in Egypt.

## Decision

### Services

| Component | Stack | Notes |
| --- | --- | --- |
| `services/fix-gateway` | Java 21, QuickFIX/J, Gradle | FIX sessions, raw message store, bank simulator for tests. No business logic. |
| `services/api` | TypeScript, NestJS, Prisma, PostgreSQL 16 | Modular monolith, one module per bounded context (below). |
| `apps/client-web` | React + TypeScript + Vite | White-label client app, EN/AR with RTL, mobile-first. |
| `apps/broker-console` | React + TypeScript + Vite | Broker compliance, dealing, ops, finance, configuration. |
| `apps/admin-console` | React + TypeScript + Vite | Agyal operators: tenants, banks, sessions, billing, platform health. |
| `apps/bank-portal` | React + TypeScript + Vite | For `PORTAL`-mode banks: answer RFQs, confirm fills. |
| `packages/shared-types` | TypeScript | FIX enums and message shapes shared by API and front ends. |

API bounded contexts (modules): `tenancy`, `identity`, `onboarding`,
`investor-code` (MCDR), `instruments`, `pricing`, `rfq`, `orders`,
`bank-adapters` (portal/file), `ledger`, `reconciliation`, `billing`,
`audit`, `notifications`. Modules talk through interfaces and events, so a
module can be extracted into a service later.

The API and gateway exchange FIX-shaped messages through a transactional
outbox/inbox in PostgreSQL in Phase 1; a broker (RabbitMQ/SQS) replaces it
when volume requires.

### Security

- TLS everywhere; FIX over TLS or VPN per bank.
- Authentication in the API (JWT access + rotating refresh tokens), MFA
  required for all broker, bank and Agyal users; OTP step-up for client
  sensitive actions (withdrawals, bank account change).
- Per-tenant data keys (ADR 0002); secrets in a managed secrets store.
- Immutable audit log for every state-changing action, with actor, tenant,
  IP and before/after.
- Least-privilege access for Agyal staff to tenant data, with audited
  break-glass.

### Hosting

- Hosting must satisfy FRA outsourcing and data-residency expectations and
  PDPL cross-border transfer rules. The preferred target is an Egyptian
  cloud/data-centre region or a provider the brokers' regulator accepts
  (open question); the stack is containerised (Docker) and cloud-neutral so
  it can run there or on a major cloud region if permitted.
- Environments: `local` (docker-compose), `staging` (with the bank
  simulator), `production`. Infrastructure as code once the provider is
  chosen.

### Localisation

- All client-facing text in English and Arabic; Arabic is right-to-left and
  uses fonts with full Arabic support; numbers and dates follow the selected
  locale; Cairo time zone and the Egyptian business calendar.

## Consequences

- Two languages/runtimes; mitigated by the thin gateway and shared
  FIX-shaped types.
- Cloud-neutral containers cost some convenience (no heavy use of one
  provider's managed services) in exchange for regulatory flexibility.
