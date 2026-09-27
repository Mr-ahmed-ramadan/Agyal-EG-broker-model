import { describe, expect, it } from 'vitest';
import { ExecType, OrdStatus } from '@agyal/shared-types';
import { applyExecution } from '../../src/domain/order-state';

const pending = { ordStatus: OrdStatus.PendingNew, orderQty: '100000', cumQty: '0' };

describe('FIX order state machine', () => {
  it('goes PendingNew -> New -> Filled', () => {
    const acked = applyExecution(pending, { execType: ExecType.New, ordStatus: OrdStatus.New });
    expect(acked).toMatchObject({ ordStatus: OrdStatus.New, terminal: false });
    const filled = applyExecution(
      { ordStatus: OrdStatus.New, orderQty: '100000', cumQty: '0' },
      { execType: ExecType.Trade, ordStatus: OrdStatus.Filled, lastQty: '100000' },
    );
    expect(filled.terminal).toBe(true);
    expect(filled.cumQty.toFixed(2)).toBe('100000.00');
    expect(filled.filledQty.toFixed(2)).toBe('100000.00');
  });

  it('handles partial fills', () => {
    const partial = applyExecution(
      { ordStatus: OrdStatus.New, orderQty: '100000', cumQty: '0' },
      { execType: ExecType.Trade, ordStatus: OrdStatus.PartiallyFilled, lastQty: '40000' },
    );
    expect(partial).toMatchObject({ ordStatus: OrdStatus.PartiallyFilled, terminal: false });
  });

  it('rejects overfills and inconsistent statuses', () => {
    const order = { ordStatus: OrdStatus.New, orderQty: '100000', cumQty: '60000' };
    expect(() =>
      applyExecution(order, { execType: ExecType.Trade, ordStatus: OrdStatus.Filled, lastQty: '50000' }),
    ).toThrow(/Overfill/);
    expect(() =>
      applyExecution(order, { execType: ExecType.Trade, ordStatus: OrdStatus.Filled, lastQty: '10000' }),
    ).toThrow(/inconsistent/);
  });

  it('refuses any report on a terminal order', () => {
    expect(() =>
      applyExecution(
        { ordStatus: OrdStatus.Rejected, orderQty: '1', cumQty: '0' },
        { execType: ExecType.New, ordStatus: OrdStatus.New },
      ),
    ).toThrow(/terminal/);
  });

  it('refuses invalid transitions', () => {
    expect(() =>
      applyExecution(
        { ordStatus: OrdStatus.New, orderQty: '1', cumQty: '0' },
        { execType: ExecType.Rejected, ordStatus: OrdStatus.Rejected },
      ),
    ).toThrow(/Invalid OrdStatus transition/);
  });
});
