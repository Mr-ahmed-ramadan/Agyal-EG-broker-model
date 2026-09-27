import { useState, type FormEvent } from 'react';
import { api, getToken, setToken } from './api';
import { BrokersScreen } from './screens/BrokersScreen';
import { FixScreen } from './screens/FixScreen';
import { InstrumentsScreen } from './screens/InstrumentsScreen';

const SCREENS = {
  brokers: { label: 'Brokers', el: BrokersScreen },
  instruments: { label: 'Instruments', el: InstrumentsScreen },
  fix: { label: 'FIX monitor', el: FixScreen },
} as const;
type ScreenKey = keyof typeof SCREENS;

export function App() {
  const [token, setTok] = useState(getToken());
  const [screen, setScreen] = useState<ScreenKey>('brokers');
  if (!token) {
    return <Login onSignedIn={(t) => { setToken(t); setTok(t); }} />;
  }
  const Screen = SCREENS[screen].el;
  return (
    <div className="layout">
      <aside>
        <h1>Agyal admin</h1>
        <nav>
          {(Object.keys(SCREENS) as ScreenKey[]).map((k) => (
            <button key={k} className={k === screen ? 'on' : ''} onClick={() => setScreen(k)}>
              {SCREENS[k].label}
            </button>
          ))}
        </nav>
        <button className="link" onClick={() => { setToken(null); setTok(null); }}>
          Sign out
        </button>
      </aside>
      <main>
        <Screen />
      </main>
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
      if (!res.user.roles.includes('PLATFORM_ADMIN')) throw new Error('Only Agyal operators can use the admin console');
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
      <h1>Agyal admin</h1>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary">Continue</button>
    </form>
  );
}
