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
 Client (broker-branded web app)
   │ onboard: eKYC → AML → suitability → unified code → broker approval
   │ request price / accept quote
   ▼
 API (NestJS, multi-tenant)  ── pricing (broker markup) ── ledger (per broker)
   │ FIX-shaped messages (QuoteRequest, NewOrderSingle, ExecutionReport)
   ▼
 FIX gateway (Java, QuickFIX/J) ──FIX 4.4──▶ Partner banks
                                  (or bank portal / file adapters for banks without FIX)
```

## Start here

- [`docs/architecture/`](docs/architecture/): the design decisions (ADRs).
  Read them before making structural changes.
- [`docs/architecture/open-questions.md`](docs/architecture/open-questions.md):
  regulatory, market-infrastructure and bank questions still to answer.
- [`docs/fix/`](docs/fix/): FIX primer and per-bank rules of engagement.

## Repository layout

```
apps/
  client-web/        # White-label client app (EN/AR, RTL), web only at launch
  broker-console/    # Broker compliance, dealing, ops, finance, configuration
  admin-console/     # Agyal operators: tenants, banks, FIX sessions, billing
  bank-portal/       # For banks without FIX: answer RFQs, confirm fills
services/
  api/               # NestJS modular monolith, one module per bounded context
  fix-gateway/       # Java 21 + QuickFIX/J: FIX sessions, bank simulator
packages/
  shared-types/      # FIX enums/message shapes and tenancy types
docs/
  architecture/      # ADRs and open questions
  fix/               # FIX primer, bank rules-of-engagement template
```

## Running locally

Requirements: Node 20+, Java 21, Docker (for PostgreSQL).

```bash
cp .env.example .env
docker compose up -d                 # PostgreSQL
npm install
npm run build

npm run dev:api                      # http://localhost:3000/health
npm run dev:client-web               # http://localhost:5173
npm run dev:broker-console           # http://localhost:5174
npm run dev:admin-console            # http://localhost:5175
npm run dev:bank-portal              # http://localhost:5176

# FIX gateway + local bank simulator (two terminals)
cd services/fix-gateway
./gradlew runSimulator
./gradlew run
./gradlew test                       # gateway ↔ simulator logon test
```

## Status

Architecture and skeleton only. The ADRs, repository structure, core data
model (`services/api/prisma/schema.prisma`, not yet migrated), empty API
modules, placeholder front ends and a FIX gateway that logs on to a local
bank simulator are in place. No business logic, vendor integrations (eKYC,
AML, MCDR, payments) or real bank connections exist yet.
