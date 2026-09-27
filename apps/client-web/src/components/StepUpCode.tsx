import { useState, type FormEvent } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';

export interface StepUpChallenge {
  challengeId: string;
  sentTo: string;
  devCode?: string;
}

/** Confirms a sensitive action with the SMS code the API just sent. */
export function StepUpCode<T>({
  challenge,
  onDone,
  onCancel,
}: {
  challenge: StepUpChallenge;
  onDone: (result: T) => void;
  onCancel: () => void;
}) {
  const { t } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await api<T>('POST', '/step-up/confirm', { challengeId: challenge.challengeId, code }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="muted">
        {t('stepUpHelp')} <span dir="ltr" className="nowrap">{challenge.sentTo}</span>
      </p>
      <label>
        {t('code')}
        <input
          className="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          autoFocus
          required
        />
      </label>
      {challenge.devCode ? (
        <p className="muted">
          {t('devCode')}: <span dir="ltr">{challenge.devCode}</span>
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <button className="primary" disabled={busy || code.length !== 6}>
        {t('confirm')}
      </button>
      <button type="button" className="link" onClick={onCancel}>
        {t('back')}
      </button>
    </form>
  );
}
