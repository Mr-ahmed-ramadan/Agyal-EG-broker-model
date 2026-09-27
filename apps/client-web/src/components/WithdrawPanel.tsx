import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { StepUpCode, type StepUpChallenge } from './StepUpCode';

interface BankAccount {
  id: string;
  iban: string;
  bankName: string;
  holderName: string;
}

/**
 * Withdraw settled cash to the client's own bank account. Adding the account
 * and requesting the withdrawal each need an SMS code (step-up).
 */
export function WithdrawPanel({
  withdrawable,
  onClose,
  onDone,
}: {
  withdrawable: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, locale } = useApp();
  const [account, setAccount] = useState<BankAccount | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null);
  const [form, setForm] = useState({ iban: '', bankName: '', holderName: '' });
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAccounts = () => api<BankAccount[]>('GET', '/bank-accounts').then((a) => setAccount(a[0] ?? null));
  useEffect(() => {
    void loadAccounts();
  }, []);

  async function start(e: FormEvent, path: string, body: unknown) {
    e.preventDefault();
    setError(null);
    try {
      setChallenge(await api<StepUpChallenge>('POST', path, body));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <div className="row static plain">
        <h2>{t('withdrawTitle')}</h2>
        <button className="link" onClick={onClose}>
          {t('close')}
        </button>
      </div>

      {challenge ? (
        <StepUpCode<{ action: string }>
          challenge={challenge}
          onCancel={() => setChallenge(null)}
          onDone={(r) => {
            setChallenge(null);
            if (r.action === 'ADD_BANK_ACCOUNT') void loadAccounts();
            else {
              setAmount('');
              setMessage(t('withdrawalRequested'));
              onDone();
            }
          }}
        />
      ) : account === undefined ? (
        <p>{t('loading')}</p>
      ) : account === null ? (
        <form className="form" onSubmit={(e) => start(e, '/bank-accounts', form)}>
          <h3>{t('addBankAccount')}</h3>
          <label>
            {t('iban')}
            <input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })} required dir="ltr" placeholder="EG38 0019 0005 ..." />
          </label>
          <label>
            {t('bankName')}
            <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required />
          </label>
          <label>
            {t('holderName')}
            <input value={form.holderName} onChange={(e) => setForm({ ...form, holderName: e.target.value })} required dir="ltr" />
          </label>
          <button className="primary">{t('continue')}</button>
        </form>
      ) : (
        <form className="form" onSubmit={(e) => start(e, '/withdrawals', { amount, bankAccountId: account.id })}>
          <p>
            {t('yourBankAccount')}: <strong>{account.bankName}</strong>{' '}
            <span dir="ltr" className="nowrap">{account.iban}</span>
          </p>
          <label>
            {t('amount')}
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" dir="ltr" required />
            <small>
              {t('withdrawable')}: {money(withdrawable, locale)}
            </small>
          </label>
          <button className="primary" disabled={!amount || Number(amount) <= 0}>
            {t('withdraw')}
          </button>
        </form>
      )}
      {message ? <p className="ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
