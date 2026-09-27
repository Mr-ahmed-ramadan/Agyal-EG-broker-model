# ADR 0004: Bank Connectivity (FIX Gateway & Adapters)

## Status

Accepted

## Context

All execution is OTC with partner banks (ADR 0003). Egyptian banks differ a
lot in technical maturity: some fixed-income desks can run a FIX session,
many cannot and work by phone, email or spreadsheet. The platform must reach
all of them without a second order model.

## Decision

### A dedicated FIX gateway service

- `services/fix-gateway` is a separate **Java 21 + QuickFIX/J** service. It
  owns FIX sessions (logon, heartbeats, sequence numbers, resend, reset
  schedules), message validation against the data dictionary, and the raw
  message store.
- The gateway is deliberately thin: no business rules. It translates between
  FIX sessions and the platform's internal message bus, where messages are
  carried in FIX-shaped JSON (same field names and enums as ADR 0003).
- Internal transport: a durable queue (PostgreSQL-backed outbox/inbox in
  Phase 1; a message broker such as RabbitMQ or SQS when volume requires).
  Every message is idempotent on its FIX identifiers (`ClOrdID`, `ExecID`,
  `QuoteID`).
- Why Java: QuickFIX/J is the mature, widely deployed open-source FIX engine;
  Node.js FIX libraries are far less proven. Keeping FIX in its own service
  also means the gateway can be certified, deployed and scaled
  independently of the rest of the platform.

### Per-bank connection modes

Each `Bank` has one of:

| Mode | How it works | What the core sees |
| --- | --- | --- |
| `FIX` | Bank runs a FIX acceptor; the gateway is the initiator (session per bank; a bank may require one session per broker). | Real FIX messages. |
| `PORTAL` | Bank dealers use the platform's **bank portal** to answer RFQs and confirm fills. | The portal emits the same `Quote` / `ExecutionReport` messages. |
| `FILE` | Batch file drop (SFTP/CSV) for end-of-day confirmations. | The file adapter emits `ExecutionReport`s. |

The portal and file adapters live in the API, not the gateway, but they
produce messages with identical shape, so order management does not know or
care which mode a bank uses.

### Relationship model

- `Bank` is platform-level; `BrokerBankRelationship` links a tenant to a bank
  with: the broker's account/identifier at the bank, enabled instruments,
  limits, FIX session (if per-broker), settlement instructions, and the bank's
  custody arrangement for that broker.
- A broker only sends RFQs to banks it has an active relationship with.

### Session security and operations

- FIX over TLS (or via a site-to-site VPN/leased line if a bank requires),
  with per-session credentials stored in a secrets manager.
- Session schedules follow Cairo business days and bank cut-offs; the
  Egyptian weekend (Friday/Saturday) and public holidays come from a
  maintained calendar.
- Each bank connection goes through a certification checklist (logon,
  sequence reset, resend, RFQ, reject paths, cancel, busted trade) before
  going live. A **bank simulator** (a QuickFIX/J acceptor) ships in the repo
  for local development and automated tests.
- Operations dashboard: session status, last heartbeat, message rates,
  rejects, quote response times per bank. File/portal banks show their
  latency honestly to brokers.

## Consequences

- Two runtimes (JVM + Node) to build, deploy and monitor. Accepted for FIX
  reliability; the gateway's surface area is kept small to limit the cost.
- Adding a bank = configuration plus, at most, a new dictionary or custom
  tag mapping; the core domain does not change.
- Bank rules of engagement (party roles, custom tags, quote validity, T-bill
  auction handling) are documented per bank in `docs/fix/banks/`.
