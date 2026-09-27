import { useEffect } from 'react';
import { egp, useLoad, when } from '../useLoad';

const STATUS: Record<string, string> = {
  A: 'Pending new', '0': 'New', '1': 'Partially filled', '2': 'Filled', '4': 'Canceled', '8': 'Rejected', C: 'Expired',
};

interface Order {
  id: string;
  clOrdId: string;
  clientId: string;
  side: 'BUY' | 'SELL';
  isin: string;
  quantity: string;
  ordStatus: string;
  text: string | null;
  createdAt: string;
  price: { clientCleanPx: string; clientYield: string | null; netAmount: string; commission: string; settlDate: string };
}

export function OrdersScreen() {
  const { data, error, reload } = useLoad<Order[]>('/broker/orders');
  useEffect(() => {
    const t = window.setInterval(reload, 3000);
    return () => window.clearInterval(t);
  }, [reload]);
  return (
    <section>
      <h2>Orders</h2>
      <p className="muted">One order per client, buy or sell, routed to the bank whose quote the client accepted. Status follows the bank&apos;s FIX execution reports.</p>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr><th>ClOrdID</th><th>Side</th><th>ISIN</th><th>Nominal</th><th>Client yield</th><th>Client pays / receives</th><th>Status</th><th>Settles</th><th>Created</th></tr>
        </thead>
        <tbody>
          {data?.map((o) => (
            <tr key={o.id}>
              <td className="mono">{o.clOrdId}</td>
              <td>{o.side === 'BUY' ? 'Buy' : 'Sell'}</td>
              <td className="mono">{o.isin}</td>
              <td>{Number(o.quantity).toLocaleString('en')}</td>
              <td>{o.price.clientYield ? `${(Number(o.price.clientYield) * 100).toFixed(3)}%` : '-'}</td>
              <td>{egp(o.price.netAmount)}</td>
              <td>{STATUS[o.ordStatus] ?? o.ordStatus}{o.text ? <div className="muted">{o.text}</div> : null}</td>
              <td>{when(o.price.settlDate).split(',')[0]}</td>
              <td>{when(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
