/**
 * FIX semantics used as the platform's internal order model (ADR 0003).
 * Enum values are the FIX wire values, so they can be stored and compared
 * directly against messages from the FIX gateway.
 */

/** MsgType(35) values the platform uses. */
export enum MsgType {
  ExecutionReport = '8',
  OrderCancelReject = '9',
  NewOrderSingle = 'D',
  OrderCancelRequest = 'F',
  QuoteRequest = 'R',
  Quote = 'S',
  QuoteCancel = 'Z',
  QuoteRequestReject = 'AG',
  QuoteResponse = 'AJ',
  TradeCaptureReport = 'AE',
  Confirmation = 'AK',
}

/** OrdStatus(39). */
export enum OrdStatus {
  New = '0',
  PartiallyFilled = '1',
  Filled = '2',
  Canceled = '4',
  PendingCancel = '6',
  Rejected = '8',
  PendingNew = 'A',
  Expired = 'C',
}

/** ExecType(150). */
export enum ExecType {
  New = '0',
  Canceled = '4',
  Rejected = '8',
  PendingNew = 'A',
  Expired = 'C',
  Trade = 'F',
  TradeCorrect = 'G',
  TradeCancel = 'H',
  OrderStatus = 'I',
}

/** Side(54). */
export enum Side {
  Buy = '1',
  Sell = '2',
}

/** OrdType(40). */
export enum OrdType {
  Market = '1',
  Limit = '2',
  PreviouslyQuoted = 'D',
}

/** PriceType(423). */
export enum PriceType {
  PercentageOfPar = '1',
  Yield = '9',
}

/** SecurityIDSource(22). */
export enum SecurityIDSource {
  Isin = '4',
}

export type Iso8601 = string;
/** Decimal amounts travel as strings to avoid floating-point loss. */
export type Decimal = string;

export interface Party {
  /** PartyID(448) */
  partyId: string;
  /** PartyIDSource(447) */
  partyIdSource: string;
  /** PartyRole(452) - roles agreed per bank in its rules of engagement */
  partyRole: number;
}

export interface Instrument {
  securityId: string;
  securityIdSource: SecurityIDSource;
}

export interface QuoteRequestMsg {
  msgType: MsgType.QuoteRequest;
  quoteReqId: string;
  instrument: Instrument;
  side: Side;
  orderQty: Decimal;
  settlDate?: string;
  parties: Party[];
}

export interface QuoteMsg {
  msgType: MsgType.Quote;
  quoteReqId: string;
  quoteId: string;
  instrument: Instrument;
  priceType: PriceType;
  bidPx?: Decimal;
  offerPx?: Decimal;
  bidYield?: Decimal;
  offerYield?: Decimal;
  validUntilTime: Iso8601;
  transactTime: Iso8601;
}

export interface NewOrderSingleMsg {
  msgType: MsgType.NewOrderSingle;
  clOrdId: string;
  quoteId?: string;
  instrument: Instrument;
  side: Side;
  orderQty: Decimal;
  ordType: OrdType;
  priceType: PriceType;
  price?: Decimal;
  settlDate?: string;
  parties: Party[];
  transactTime: Iso8601;
}

export interface ExecutionReportMsg {
  msgType: MsgType.ExecutionReport;
  orderId: string;
  clOrdId: string;
  execId: string;
  execType: ExecType;
  ordStatus: OrdStatus;
  instrument: Instrument;
  side: Side;
  orderQty: Decimal;
  lastQty?: Decimal;
  lastPx?: Decimal;
  cumQty: Decimal;
  leavesQty: Decimal;
  accruedInterestAmt?: Decimal;
  grossTradeAmt?: Decimal;
  netMoney?: Decimal;
  settlDate?: string;
  text?: string;
  transactTime: Iso8601;
}

/** Order states from which no further ExecutionReports change the order. */
export const TERMINAL_ORD_STATUSES: ReadonlySet<OrdStatus> = new Set([
  OrdStatus.Filled,
  OrdStatus.Canceled,
  OrdStatus.Rejected,
  OrdStatus.Expired,
]);
