import { useState, type FormEvent } from 'react';
import { api, getToken, setToken } from './api';
import { ClientsScreen } from './screens/ClientsScreen';
import { ComplianceScreen } from './screens/ComplianceScreen';
import { DepositsScreen } from './screens/DepositsScreen';
import { LedgerScreen } from './screens/LedgerScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { UnifiedCodesScreen } from './screens/UnifiedCodesScreen';

const SCREENS = {
  compliance: { label: 'Compliance queue', roles: ['BROKER_COMPLIANCE', 'BROKER_ADMIN'], el: ComplianceScreen },
  codes: { label: 'Unified codes & custody', roles: ['BROKER_OPS', 'BROKER_ADMIN'], el: UnifiedCodesScreen },
  deposits: { label: 'Deposits', roles: ['BROKER_OPS', 'BROKER_FINANCE', 'BROKER_ADMIN'], el: DepositsScreen },
  clients: { label: 'Clients', roles: ['BROKER_COMPLIANCE', 'BROKER_OPS', 'BROKER_ADMIN'], el: ClientsScreen },
  orders: { label: 'Orders', roles: ['BROKER_DEALER', 'BROKER_OPS', 'BROKER_ADMIN', 'BROKER_COMPLIANCE'], el: OrdersScreen },
  ledger: { label: 'Ledger', roles: ['BROKER_FINANCE', 'BROKER_OPS', 'BROKER_ADMIN'], el: LedgerScreen },
} as const;
type ScreenKey = keyof typeof SCREENS;

function rolesFromToken(token: string | null): string[] {
  if (!token) return [];
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).roles ?? [];
  } catch {
    return [];
  }
}

export function App() {
  const [token, setTok] = useState(getToken());
  const roles = rolesFromToken(token);
  const allowed = (Object.keys(SCREENS) as ScreenKey[]).filter((k) =>
    SCREENS[k].roles.some((r) => roles.includes(r)),
  );
  const [screen, setScreen] = useState<ScreenKey | null>(null);
  const current = screen && allowed.includes(screen) ? screen : allowed[0];

  if (!token || roles.includes('CLIENT')) {
    return <Login onSignedIn={(t) => { setToken(t); setTok(t); }} />;
  }
  const Screen = current ? SCREENS[current].el : null;
  return (
    <div className="layout">
      <aside>
        <h1>Broker console</h1>
        <nav>
          {allowed.map((k) => (
            <button key={k} className={k === current ? 'on' : ''} onClick={() => setScreen(k)}>
              {SCREENS[k].label}
            </button>
          ))}
        </nav>
        <button className="link" onClick={() => { setToken(null); setTok(null); }}>
          Sign out
        </button>
      </aside>
      <main>{Screen ? <Screen /> : <p>No screens for your role.</p>}</main>
    </div>
  );
}

function Login({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api('POST', '/auth/login', { email, password });
      if (res.user.roles.includes('CLIENT')) throw new Error('Client accounts cannot use the broker console');
      onSignedIn(res.accessToken);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <form className="card login" onSubmit={submit}>
      <h1>Broker console</h1>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary">Sign in</button>
    </form>
  );
}
