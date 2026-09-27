# Bank: Local simulator (SIMBANK, SIMBANK2) — Rules of Engagement

Test double in `services/fix-gateway/src/main/java/eg/agyal/fixgateway/simulator/`.

## Connection

- Mode: FIX
- FIX version and dictionary: FIX 4.4, standard QuickFIX/J `FIX44.xml`
- Connectivity: plain TCP on `localhost:9880` (local only)
- SenderCompID / TargetCompID: platform `AGYAL`; banks `SIMBANK`, `SIMBANK2` (one acceptor, two sessions)
- Session schedule: always on, `ResetOnLogon=Y`
- One shared session per bank; broker identified in `NoPartyIDs`

## RFQ

- Supported instruments: all four types; instrument data read from the platform database
- Quote validity (`ValidUntilTime`): 60 seconds (`SIM_QUOTE_VALID_SECONDS`)
- Price type: `PriceType=1` (% of par) with `OfferPx` (clean) and `OfferYield`
- Demo offer yields: T-bill 26.5%, T-bond 24.5%, corporate 28.5%, sukuk 27.5%; `SIMBANK2` quotes 20 bps lower

## Orders & executions

- `OrdType=D` (previously quoted) with `QuoteID`; quote must be live and match ISIN and quantity, otherwise `ExecType=8` rejected
- Fills: `ExecutionReport` New, then Trade (full fill) with `LastPx`, `AccruedInterestAmt`, `NetMoney`, `SettlDate`
- Party roles in `NoPartyIDs(453)`: 1 = executing firm (broker account at bank), 3 = client (unified code)
- No partial fills, cancels or busts yet

## Settlement & custody

- `SettlDate` echoed from the request (platform default T+1 business day, Friday/Saturday weekend)
