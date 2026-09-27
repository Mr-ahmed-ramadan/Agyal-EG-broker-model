import Decimal from 'decimal.js';
import { ExecType, OrdStatus, TERMINAL_ORD_STATUSES } from '@agyal/shared-types';

/**
 * FIX order state machine (ADR 0003). The order's status is only ever changed
 * by applying an ExecutionReport.
 */

const ALLOWED: Record<OrdStatus, OrdStatus[]> = {
  [OrdStatus.PendingNew]: [
    OrdStatus.New,
    OrdStatus.PartiallyFilled,
    OrdStatus.Filled,
    OrdStatus.Rejected,
    OrdStatus.Canceled,
    OrdStatus.Expired,
  ],
  [OrdStatus.New]: [
    OrdStatus.PartiallyFilled,
    OrdStatus.Filled,
    OrdStatus.Canceled,
    OrdStatus.PendingCancel,
    OrdStatus.Expired,
  ],
  [OrdStatus.PartiallyFilled]: [
    OrdStatus.PartiallyFilled,
    OrdStatus.Filled,
    OrdStatus.Canceled,
    OrdStatus.PendingCancel,
    OrdStatus.Expired,
  ],
  [OrdStatus.PendingCancel]: [
    OrdStatus.Canceled,
    OrdStatus.PartiallyFilled,
    OrdStatus.Filled,
    OrdStatus.New,
  ],
  [OrdStatus.Filled]: [],
  [OrdStatus.Canceled]: [],
  [OrdStatus.Rejected]: [],
  [OrdStatus.Expired]: [],
};

export interface OrderSnapshot {
  ordStatus: OrdStatus;
  orderQty: Decimal.Value;
  cumQty: Decimal.Value;
}

export interface ExecutionInput {
  execType: ExecType;
  ordStatus: OrdStatus;
  lastQty?: Decimal.Value;
}

export interface ExecutionOutcome {
  ordStatus: OrdStatus;
  cumQty: Decimal;
  /** Nominal filled by this report (0 unless ExecType=Trade) */
  filledQty: Decimal;
  terminal: boolean;
}

export function applyExecution(order: OrderSnapshot, exec: ExecutionInput): ExecutionOutcome {
  const from = order.ordStatus;
  if (TERMINAL_ORD_STATUSES.has(from)) {
    throw new Error(`Order already terminal (${from})`);
  }
  if (exec.ordStatus !== from && !ALLOWED[from].includes(exec.ordStatus)) {
    throw new Error(`Invalid OrdStatus transition ${from} -> ${exec.ordStatus}`);
  }

  const orderQty = new Decimal(order.orderQty);
  let cumQty = new Decimal(order.cumQty);
  let filledQty = new Decimal(0);

  if (exec.execType === ExecType.Trade) {
    filledQty = new Decimal(exec.lastQty ?? 0);
    if (!filledQty.gt(0)) throw new Error('Trade ExecutionReport without LastQty');
    cumQty = cumQty.plus(filledQty);
    if (cumQty.gt(orderQty)) throw new Error('Overfill: CumQty exceeds OrderQty');
    const expected = cumQty.eq(orderQty) ? OrdStatus.Filled : OrdStatus.PartiallyFilled;
    if (exec.ordStatus !== expected) {
      throw new Error(`Trade report status ${exec.ordStatus} inconsistent with quantities`);
    }
  }

  return {
    ordStatus: exec.ordStatus,
    cumQty,
    filledQty,
    terminal: TERMINAL_ORD_STATUSES.has(exec.ordStatus),
  };
}
