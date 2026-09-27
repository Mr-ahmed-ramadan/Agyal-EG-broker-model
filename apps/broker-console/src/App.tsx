import { useState, type FormEvent } from 'react';
import { api, getToken, setToken } from './api';
import { ClientsScreen } from './screens/ClientsScreen';
import { ComplianceScreen } from './screens/ComplianceScreen';
import { DepositsScreen } from './screens/DepositsScreen';
import { LedgerScreen } from './screens/LedgerScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { SettlementsScreen } from './screens/SettlementsScreen';
import { WithdrawalsScreen } from './screens/WithdrawalsScreen';
import { UnifiedCodesScreen } from './screens/UnifiedCodesScreen';

const SCREENS = {
  compliance: { label: 'Compliance queue', roles: ['BROKER_COMPLIANCE', 'BROKER_ADMIN'], el: ComplianceScreen },
  codes: { label: 'Unified codes & custody', roles: ['BROKER_OPS', 'BROKER_ADMIN'], el: UnifiedCodesScreen },
  deposits: { label: 'Deposits', roles: ['BROKER_OPS', 'BROKER_FINANCE', 'BROKER_ADMIN'], el: DepositsScreen },
  clients: { label: 'Clients', roles: ['BROKER_COMPLIANCE', 'BROKER_OPS', 'BROKER_ADMIN'], el: ClientsScreen },
  orders: { label: 'Orders', roles: ['BROKER_DEALER', 'BROKER_OPS', 'BROKER_ADMIN', 'BROKER_COMPLIANCE'], el: OrdersScreen },
  settlements: { label: 'Settlements', roles: ['BROKER_OPS', 'BROKER_ADMIN'], el: SettlementsScreen },
  withdrawals: { label: 'Withdrawals', roles: ['BROKER_FINANCE', 'BROKER_OPS', 'BROKER_ADMIN'], el: WithdrawalsScreen },
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
      <main>{Screen ? <Screen roles={roles} /> : <p>No screens for your role.</p>}</main>
    </div>
  );
}

interface Challenge {
  challengeId: string;
  sentTo: string;
  devCode?: string;
}

/** Two-step sign-in: password, then the SMS code (required for all broker staff). */
function Login({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setChallenge(await api<Challenge>('POST', '/auth/login', { email, password }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api('POST', '/auth/verify-otp', { challengeId: challenge!.challengeId, code });
      if (res.user.roles.includes('CLIENT')) throw new Error('Client accounts cannot use the broker console');
      onSignedIn(res.accessToken);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function resend() {
    setError(null);
    try {
      setChallenge(await api<Challenge>('POST', '/auth/resend-otp', { challengeId: challenge!.challengeId }));
      setCode('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (challenge) {
    return (
      <form className="card login" onSubmit={submitCode}>
        <h1>Enter your code</h1>
        <p className="muted">We sent a 6-digit code by SMS to {challenge.sentTo}.</p>
        <label>
          Verification code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </label>
        {challenge.devCode ? <p className="muted">Development code: {challenge.devCode}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" disabled={code.length !== 6}>Verify</button>
        <button type="button" className="link" onClick={resend}>Send a new code</button>
        <button type="button" className="link" onClick={() => { setChallenge(null); setCode(''); }}>Back</button>
      </form>
    );
  }

  return (
    <form className="card login" onSubmit={submitPassword}>
      <h1>Broker console</h1>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary">Continue</button>
    </form>
  );
}
