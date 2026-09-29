import { useState, type FormEvent } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';

interface Challenge {
  challengeId: string;
  sentTo: string;
  expiresAt: string;
  devCode?: string;
}

/** Start on Sign in when the link says so (e.g. the demo link uses ?login=1). */
function initialMode(): 'login' | 'register' {
  try {
    return new URLSearchParams(window.location.search).has('login') ? 'login' : 'register';
  } catch {
    return 'register';
  }
}

export function AuthPage({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const { t } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [form, setForm] = useState({ email: '', password: '', mobile: '', fullNameEn: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Step 1 (password or registration) sends an SMS code; step 2 verifies it.
      const res =
        mode === 'login'
          ? await api<Challenge>('POST', '/auth/login', { email: form.email, password: form.password })
          : await api<Challenge>('POST', '/auth/register', form);
      setChallenge(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <CodeStep
        challenge={challenge}
        onChallenge={setChallenge}
        onSignedIn={onSignedIn}
        onBack={() => {
          setChallenge(null);
          setMode('login');
        }}
      />
    );
  }

  return (
    <section className="card narrow">
      <p className="lead">{t('tagline')}</p>
      <div className="authtabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
          {t('signIn')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
          {t('openAccount')}
        </button>
      </div>
      <form onSubmit={submit} className="form">
        {mode === 'register' ? (
          <>
            <label>
              {t('fullNameEn')}
              <input value={form.fullNameEn} onChange={set('fullNameEn')} required dir="ltr" />
            </label>
            <label>
              {t('mobile')}
              <input value={form.mobile} onChange={set('mobile')} required inputMode="tel" dir="ltr" placeholder="01012345678" />
            </label>
          </>
        ) : null}
        <label>
          {t('email')}
          <input type="email" value={form.email} onChange={set('email')} required dir="ltr" />
        </label>
        <label>
          {t('password')}
          <input type="password" value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 10 : 1} />
          {mode === 'register' ? <small>{t('passwordHint')}</small> : null}
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" disabled={busy}>
          {mode === 'login' ? t('signIn') : t('openAccount')}
        </button>
      </form>
    </section>
  );
}

function CodeStep({
  challenge,
  onChallenge,
  onSignedIn,
  onBack,
}: {
  challenge: Challenge;
  onChallenge: (c: Challenge) => void;
  onSignedIn: (token: string) => void;
  onBack: () => void;
}) {
  const { t } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api('POST', '/auth/verify-otp', { challengeId: challenge.challengeId, code });
      onSignedIn(res.accessToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      onChallenge(await api<Challenge>('POST', '/auth/resend-otp', { challengeId: challenge.challengeId }));
      setCode('');
      setNotice(t('codeResent'));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card narrow">
      <h1>{t('codeTitle')}</h1>
      <p className="muted">
        {t('codeSentTo')} <span dir="ltr" className="nowrap">{challenge.sentTo}</span>
      </p>
      <form onSubmit={verify} className="form">
        <label>
          {t('code')}
          <input
            className="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            required
            autoFocus
          />
        </label>
        {challenge.devCode ? (
          <p className="muted">
            {t('devCode')}: <span dir="ltr">{challenge.devCode}</span>
          </p>
        ) : null}
        {notice ? <p className="muted">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" disabled={busy || code.length !== 6}>
          {t('verify')}
        </button>
      </form>
      <button className="link" onClick={resend}>
        {t('resendCode')}
      </button>
      <button className="link" onClick={onBack}>
        {t('back')}
      </button>
    </section>
  );
}
