# FIX at Agyal

A short primer for developers, plus where bank-specific details live. The
design decisions are in [ADR 0003](../architecture/0003-fix-native-order-model.md)
and [ADR 0004](../architecture/0004-bank-connectivity.md).

## The basics

- FIX messages are `tag=value` pairs separated by SOH (`\x01`). `35` is the
  message type, `49`/`56` are sender/target comp IDs, `34` is the sequence
  number.
- A **session** is a long-lived connection between two comp IDs with
  sequence numbers on both sides. Gaps trigger `ResendRequest <2>`; the engine
  (QuickFIX/J) handles this, the application never does.
- Default version: **FIX 4.4**. FIX 5.0 SP2 (over FIXT 1.1) is supported per
  session by configuration.

## Messages we use

| Flow | Message | Direction |
| --- | --- | --- |
| RFQ | `QuoteRequest <R>` | Platform → bank |
| | `Quote <S>` | Bank → platform |
| | `QuoteRequestReject <AG>` | Bank → platform |
| | `QuoteCancel <Z>` | Bank → platform |
| Order | `NewOrderSingle <D>` (`OrdType(40)=D` previously quoted, with `QuoteID(117)`) | Platform → bank |
| | `ExecutionReport <8>` | Bank → platform |
| | `OrderCancelRequest <F>` / `OrderCancelReject <9>` | Both |
| Post-trade | `Confirmation <AK>` / `TradeCaptureReport <AE>` (if supported) | Bank → platform |

## Key fixed-income tags

| Tag | Name | Use |
| --- | --- | --- |
| 11 | ClOrdID | Platform order ID (unique per session) |
| 37 | OrderID | Bank order ID |
| 17 | ExecID | Bank execution ID (idempotency key) |
| 131 / 117 | QuoteReqID / QuoteID | Link RFQ → quote → order |
| 48 / 22 | SecurityID / SecurityIDSource | ISIN, `22=4` |
| 54 | Side | `1` buy, `2` sell |
| 38 | OrderQty | Nominal (face value) |
| 423 | PriceType | `1` % of par, `9` yield |
| 133 / 634 | OfferPx / OfferYield | Bank's price to sell to a buying client |
| 132 / 632 | BidPx / BidYield | Bank's price to buy from a selling client |
| 44 / 236 | Price / Yield | |
| 159 | AccruedInterestAmt | |
| 64 | SettlDate | |
| 381 / 118 | GrossTradeAmt / NetMoney | |
| 62 | ValidUntilTime | Quote expiry |
| 453 | NoPartyIDs | Broker, client account, unified code (roles agreed per bank) |
| 39 / 150 | OrdStatus / ExecType | Order state machine |

## Per-bank rules of engagement

Each connected bank gets a file in [`banks/`](banks/) based on
[`banks/_template.md`](banks/_template.md).
