# Bank: <name> — Rules of Engagement

## Connection

- Mode: FIX / PORTAL / FILE
- FIX version and dictionary:
- Connectivity: internet TLS / VPN / leased line
- SenderCompID / TargetCompID (per environment):
- Session schedule (Cairo time), reset policy:
- One session per broker, or shared with broker in `Parties`:

## RFQ

- Supported instruments (T-bonds, T-bills, corporate bonds, sukuk):
- Quote validity (`ValidUntilTime`):
- Price type (% of par / yield):
- Minimum / maximum nominal:

## Orders & executions

- `OrdType` values accepted:
- Partial fills possible:
- Cancel/amend behaviour:
- Party roles required in `NoPartyIDs(453)`:
- Custom tags:

## Settlement & custody

- Settlement convention per instrument:
- Custody/depository for each instrument (MCDR / CBE / bank):
- Confirmation delivery (FIX / file / email):

## Certification

- [ ] Logon / logout / heartbeat
- [ ] Sequence reset and resend
- [ ] RFQ happy path and reject
- [ ] Quote expiry
- [ ] Order fill, reject, cancel
- [ ] Busted/corrected trade
