import { useState, type FormEvent } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';

export function AuthPage({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const { t } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('register');
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
      const res =
        mode === 'login'
          ? await api('POST', '/auth/login', { email: form.email, password: form.password })
          : await api('POST', '/auth/register', form);
      onSignedIn(res.accessToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card narrow">
      <p className="lead">{t('tagline')}</p>
      <h1>{mode === 'login' ? t('signIn') : t('openAccount')}</h1>
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
      <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? t('noAccount') : t('haveAccount')}
      </button>
    </section>
  );
}
