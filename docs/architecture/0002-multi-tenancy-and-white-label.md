# ADR 0002: Multi-Tenancy & White-Label

## Status

Accepted

## Context

Each broker is a customer (a **tenant**). Tenants must never see each other's
clients, orders, prices or ledgers, and each broker's clients must experience
the product as the broker's own. Brokers are small, so running a separate
stack per broker would be too expensive to operate.

## Decision

### Isolation model: shared stack, tenant-scoped data

- One deployment serves all brokers. Every tenant-owned table carries a
  non-null `tenant_id`.
- **PostgreSQL Row-Level Security (RLS)** is enabled on every tenant-owned
  table. The API sets `app.tenant_id` on the database session at the start of
  each request/transaction; RLS policies filter on it. Application-level
  filtering is still done, but RLS is the safety net if a query forgets.
- Implementation: `DbService.forTenant(tenantId, tx => ...)` runs work in a
  transaction with `app.tenant_id` set; policies are `FORCE`d so they apply to
  the table owner too. `DbService.asSystem()` sets `app.bypass_rls` and is used
  only to route inbound FIX messages to their tenant and for platform-admin
  endpoints. The end-to-end test asserts that a query without tenant context
  sees no tenant rows.
- Platform-level tables (banks, instrument master data, reference rates,
  Agyal operators) have no `tenant_id`; tenant-facing endpoints only read
  them (enforced in the API today; a separate read-only database role for
  tenant sessions is a hardening step).
- Encryption keys for sensitive personal data (national ID, documents) are
  **per tenant** (envelope encryption: a data key per tenant, wrapped by a
  KMS master key), so one tenant's data can be crypto-shredded on exit.
- A single tenant can be moved to a dedicated database later (for a large
  broker or a regulator request) without code changes, because nothing
  queries across tenants except explicit platform-admin reports.

### Identity

- Users belong to exactly one tenant, except Agyal operators (platform scope)
  and bank users (bank scope, see ADR 0004).
- The same person can be a client of two brokers; they are **two separate
  client records** in two tenants. Only the MCDR unified code links them in
  the real world (ADR 0006); the platform does not merge them.
- Roles inside a tenant: `CLIENT`, `BROKER_ADMIN`, `BROKER_COMPLIANCE`,
  `BROKER_DEALER` (reviews/releases orders), `BROKER_OPS` (settlement,
  reconciliation), `BROKER_FINANCE`. Maker-checker is enforced where a broker
  enables it (e.g. price overrides, manual ledger adjustments).

### White-label

Phase 1 is **web only**:

- Tenant is resolved from the request host: a custom domain
  (`invest.brokerx.com.eg`) or a platform subdomain (`brokerx.agyal.app`).
- Per-tenant `Branding`: name (EN/AR), logo, favicon, colour tokens,
  typography choice (from an approved list with Arabic support), support
  contacts, legal document URLs/versions, email/SMS sender identity.
- The client app reads branding at load time and applies it via CSS custom
  properties; no per-tenant builds.
- Per-tenant `TenantConfig`: enabled instruments, auto-approval rules for
  onboarding, suitability thresholds, order limits, markup/commission rules,
  cut-off times, which partner banks the broker works with.
- Outbound emails/SMS use the broker's name and templates; transactional
  documents (confirmations, statements) are rendered with the broker's
  letterhead.

## Consequences

- Every new table needs a `tenant_id` decision and an RLS policy; this is
  enforced in code review and by a migration check in CI.
- Background jobs must set the tenant context explicitly; a job with no
  tenant context can only touch platform tables.
- Custom domains need automated TLS certificates and a DNS verification step
  in broker onboarding.
- Native per-broker mobile apps (deferred) can reuse the same branding
  model.
