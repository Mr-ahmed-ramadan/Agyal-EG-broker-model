import { useState } from 'react';
import { api } from '../api';
import { egp, useLoad } from '../useLoad';

interface Pending {
  orderId: string;
  clOrdId: string;
  side: 'BUY' | 'SELL';
  isin: string;
  quantity: string;
  bankName: string;
  settlDate: string;
  overdue: boolean;
  amount: string;
}

export function SettlementsScreen() {
  const { data, error, reload } = useLoad<Pending[]>('/broker/settlements');
  return (
    <section>
      <h2>Settlements</h2>
      <p className="muted">
        Completed trades waiting for settlement with the bank. Confirm each one against the bank statement: buys are
        paid from the client-money account, sale proceeds are received into it.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {data?.length === 0 ? <p className="muted">Nothing waiting to settle.</p> : null}
      {data?.length ? (
        <table>
          <thead>
            <tr><th>Settles</th><th>Bank</th><th>Side</th><th>ISIN</th><th>Nominal</th><th className="num">Amount</th><th>Statement reference</th></tr>
          </thead>
          <tbody>
            {data.map((p) => <Row key={p.orderId} p={p} onDone={reload} />)}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function Row({ p, onDone }: { p: Pending; onDone: () => void }) {
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    try {
      await api('POST', `/broker/settlements/${p.orderId}`, { reference });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <tr>
      <td>
        {new Date(p.settlDate).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
        {p.overdue ? <div className="error">Overdue</div> : null}
      </td>
      <td>{p.bankName}</td>
      <td>{p.side === 'BUY' ? 'Pay bank' : 'Receive from bank'}</td>
      <td className="mono">{p.isin}</td>
      <td>{Number(p.quantity).toLocaleString('en')}</td>
      <td className="num">{egp(p.amount)}</td>
      <td>
        <div className="inline">
          <input aria-label={`Reference for ${p.clOrdId}`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. STMT-0927-14" />
          <button className="primary" disabled={reference.length < 3} onClick={confirm}>Confirm settled</button>
        </div>
        {error ? <div className="error">{error}</div> : null}
      </td>
    </tr>
  );
}
