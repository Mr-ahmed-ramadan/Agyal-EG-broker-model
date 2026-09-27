# Agyal Broker Platform

A white-label, **FIX-native** fixed-income platform for Egyptian brokers,
delivered as SaaS.

Many FRA-licensed brokers hold the licence to offer fixed income but have no
technology for it. Agyal gives each broker a branded client app, online
onboarding (eKYC, AML, suitability, MCDR unified code), request-for-quote and
order routing to partner banks over FIX, a client ledger with reconciliation,
and a broker back-office console. The **broker** is the licensed party for
every client and every trade; **Agyal is a pure technology provider**.

Instruments in scope: treasury bonds, T-bills, corporate bonds and sukuk,
all traded OTC with partner banks, one order per client.

## How it works

```
 Client (broker-branded web app, EN/AR)
   │ onboard: eKYC → profile → suitability → unified code → consents → auto/broker approval
   │ request price → accept best quote
   ▼
 API (NestJS, multi-tenant, PostgreSQL row-level security)
   │ pricing (broker markup + commission) · pre-trade checks · double-entry ledger
   │ FIX-shaped messages via outbox/inbox tables
   ▼
 FIX gateway (Java, QuickFIX/J) ──FIX 4.4──▶ Partner banks (local: bank simulator with 2 banks)
```

## What works today

The first end-to-end slice runs locally and in CI:

1. Agyal admin creates a broker (tenant), its staff and bank relationships.
2. A client registers on the broker's branded app and completes onboarding
   (mock eKYC and AML providers; the broker's auto-approval rules decide, or
   the application goes to the broker's compliance queue).
3. Broker operations verify the client's MCDR unified code and record custody
   accounts (manual MCDR adapter), and confirm the client's deposit.
4. The client requests a price: a FIX `QuoteRequest` goes to every partner
   bank; `Quote`s come back; the client sees the best **client** yield after
   the broker's markup, with commission and accrued interest disclosed.
5. The client accepts: pre-trade checks, cash reserve, immutable price
   snapshot, FIX `NewOrderSingle`; the bank's `ExecutionReport`s drive the
   FIX order state machine and post balanced ledger entries.
6. Broker console shows orders, clients and a trial balance that nets to
   zero per currency and per ISIN.

Screenshots from an automated browser run are in
[`docs/screenshots/`](docs/screenshots/).

## Start here

- [`docs/architecture/`](docs/architecture/): the design decisions (ADRs).
- [`docs/architecture/open-questions.md`](docs/architecture/open-questions.md):
  regulatory, market-infrastructure and bank questions still to answer.
- [`docs/fix/`](docs/fix/): FIX primer and per-bank rules of engagement.

## Repository layout

```
apps/
  client-web/        # White-label client app (EN/AR, RTL, mobile-first)
  broker-console/    # Compliance queue, unified codes & custody, deposits, orders, ledger
  admin-console/     # Agyal operators (placeholder; admin API exists)
  bank-portal/       # For banks without FIX (placeholder)
services/
  api/               # NestJS modular monolith, Prisma, PostgreSQL
    src/domain/      #   pure business rules: fixed-income math, pricing, ledger, FIX states
    src/modules/     #   one module per bounded context
    prisma/          #   schema, migrations (incl. RLS policies), seed
  fix-gateway/       # Java 21 + QuickFIX/J: bank sessions, outbox/inbox bridge, bank simulator
packages/
  shared-types/      # FIX enums/message shapes and tenancy types
scripts/e2e.sh       # starts simulator + gateway + API and runs the end-to-end flow
```

## Running locally

Requirements: Node 20+, Java 21, PostgreSQL 16 (Docker or local).

```bash
cp .env.example .env
docker compose up -d                          # PostgreSQL (or use a local server)
npm install
export DATABASE_URL="postgresql://agyal:agyal@localhost:5432/agyal_broker?schema=public"
npm run build
(cd services/api && npx prisma migrate reset --force)   # migrate + seed demo data

# Terminal 1-2: bank simulator and FIX gateway
cd services/fix-gateway && ./gradlew runSimulator
cd services/fix-gateway && ./gradlew run

# Terminal 3-5: API and apps
npm run dev:api                               # http://localhost:3000/health
npm run dev:client-web                        # http://localhost:5173
npm run dev:broker-console                    # http://localhost:5174
```

Seeded demo users (password `Demo-Pass-2026!`, local only):

| User | Where |
| --- | --- |
| `admin@agyal.local` | Agyal platform admin (API `/admin/*`) |
| `compliance@demo-broker.example` | Broker console: compliance queue |
| `ops@demo-broker.example` | Broker console: unified codes, deposits, ledger |
| `dealer@demo-broker.example` | Broker console: orders |

Clients register themselves in the client app. For the mock eKYC, use any
valid 14-digit national ID of an adult (e.g. `29001011234567`); IDs ending
in `9999` fail the face match. Names containing "Minister Example" are PEP
hits and go to the compliance queue.

## Tests

```bash
npm test                                      # API unit tests (pricing, fixed income, ledger, FIX states, onboarding)
(cd services/fix-gateway && ./gradlew test)   # FIX mapping + logon tests
./scripts/e2e.sh                              # full flow across real processes (resets the database)
```

## Not built yet

eKYC/AML/MCDR vendor integrations (mocks and a manual adapter stand in),
OTP/MFA, sell orders and early redemption, settlement confirmation and
automated reconciliation imports, PORTAL/FILE bank adapters, the admin and
bank-portal UIs, billing, notifications, and production hosting. See the
ADRs and open questions.
