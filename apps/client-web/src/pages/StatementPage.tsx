import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { date, money, nominal } from '../lib/format';

interface Line {
  journalEntryId: string;
  kind: 'DEPOSIT' | 'BUY' | 'SELL' | 'COUPON' | 'REDEMPTION' | 'WITHDRAWAL' | 'OTHER';
  reference: string;
  date: string;
  isin: string | null;
  nominal: string | null;
  amount: string;
  balance: string;
  price?: string;
  commission?: string;
  gross?: string;
  tax?: string;
}

interface Statement {
  client: { name: string; nameAr: string; unifiedCode: string | null; depositReference: string };
  broker: { nameEn: string; nameAr: string; fraLicenseNo: string | null };
  period: { from: string; to: string };
  openingBalance: string;
  closingBalance: string;
  totals: {
    deposits: string;
    withdrawals: string;
    bought: string;
    sold: string;
    income: string;
    matured: string;
    commissions: string;
    taxWithheld: string;
  };
  lines: Line[];
  holdings: { isin: string; nameEn: string; nameAr: string; maturityDate: string | null; nominal: string }[];
  instruments: Record<string, { nameEn: string; nameAr: string }>;
}

type Preset = 'thisMonth' | 'lastMonth' | 'yearToDate' | 'custom';

const iso = (d: Date) => d.toISOString().slice(0, 10);

function range(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (preset === 'lastMonth') return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
  if (preset === 'yearToDate') return { from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(now) };
  return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(now) };
}

/** Account statement for a period, printable as a PDF. */
export function StatementPage() {
  const { t, locale, tenant } = useApp();
  const [preset, setPreset] = useState<Preset>('thisMonth');
  const [period, setPeriod] = useState(range('thisMonth'));
  const [stmt, setStmt] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preset !== 'custom') setPeriod(range(preset));
  }, [preset]);

  useEffect(() => {
    api<Statement>('GET', `/statement?from=${period.from}&to=${period.to}`)
      .then((s) => {
        setStmt(s);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [period]);

  const name = (isin: string | null) => {
    if (!isin || !stmt) return '';
    const i = stmt.instruments[isin];
    return i ? (locale === 'ar' ? i.nameAr : i.nameEn) : isin;
  };
  const describe = (l: Line) => {
    if (l.kind === 'COUPON' || l.kind === 'REDEMPTION') {
      const isin = l.isin ?? l.reference.split(':')[0];
      return `${t(`kind_${l.kind}`)} · ${name(isin)}`;
    }
    if (l.kind === 'BUY' || l.kind === 'SELL') return `${t(`kind_${l.kind}`)} · ${name(l.isin)} · ${nominal(Math.abs(Number(l.nominal)), locale)}`;
    return t(`kind_${l.kind}`);
  };

  return (
    <section className="card statement">
      <div className="row static plain no-print">
        <h2>{t('statementTitle')}</h2>
        <button className="secondary" onClick={() => window.print()}>
          {t('print')}
        </button>
      </div>
      <div className="chips no-print">
        {(['thisMonth', 'lastMonth', 'yearToDate', 'custom'] as Preset[]).map((p) => (
          <button key={p} className={`chip ${preset === p ? 'on' : ''}`} onClick={() => setPreset(p)}>
            {t(p)}
          </button>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="period no-print">
          <label>
            {t('from')}
            <input type="date" value={period.from} max={period.to} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
          </label>
          <label>
            {t('to')}
            <input type="date" value={period.to} min={period.from} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
          </label>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {stmt ? (
        <>
          <header className="stmt-head">
            <div>
              <strong>{tenant.branding.displayName[locale]}</strong>
              {stmt.broker.fraLicenseNo ? (
                <small className="muted">
                  {t('brokerLicence')} {stmt.broker.fraLicenseNo}
                </small>
              ) : null}
            </div>
            <div>
              <strong>{locale === 'ar' ? stmt.client.nameAr || stmt.client.name : stmt.client.name}</strong>
              {stmt.client.unifiedCode ? (
                <small className="muted">
                  {t('unifiedCodeLabel')} <span dir="ltr">{stmt.client.unifiedCode}</span>
                </small>
              ) : null}
              <small className="muted">
                {t('period')}: {date(stmt.period.from, locale)} – {date(stmt.period.to, locale)}
              </small>
            </div>
          </header>
          <dl>
            <dt>{t('openingBalance')}</dt>
            <dd>{money(stmt.openingBalance, locale)}</dd>
            <dt>{t('deposits')}</dt>
            <dd>{money(stmt.totals.deposits, locale)}</dd>
            <dt>{t('bought')}</dt>
            <dd>−{money(stmt.totals.bought, locale)}</dd>
            <dt>{t('sold')}</dt>
            <dd>{money(stmt.totals.sold, locale)}</dd>
            <dt>{t('couponsNet')}</dt>
            <dd>{money(stmt.totals.income, locale)}</dd>
            <dt>{t('matured')}</dt>
            <dd>{money(stmt.totals.matured, locale)}</dd>
            <dt>{t('withdrawalsTotal')}</dt>
            <dd>−{money(stmt.totals.withdrawals, locale)}</dd>
            <dt className="total">{t('closingBalance')}</dt>
            <dd className="total">{money(stmt.closingBalance, locale)}</dd>
            <dt className="muted">{t('commissions')}</dt>
            <dd className="muted">{money(stmt.totals.commissions, locale)}</dd>
            <dt className="muted">{t('taxWithheld')}</dt>
            <dd className="muted">{money(stmt.totals.taxWithheld, locale)}</dd>
          </dl>
          <h3>{t('movements')}</h3>
          {stmt.lines.length === 0 ? <p className="muted">{t('noMovements')}</p> : null}
          {stmt.lines.length ? (
            <div className="table-wrap">
              <table className="table stack">
                <thead>
                  <tr>
                    <th>{t('payDate')}</th>
                    <th>{t('description')}</th>
                    <th className="num">{t('amountCol')}</th>
                    <th className="num">{t('balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stmt.lines.map((l) => (
                    <tr key={l.journalEntryId}>
                      <td className="nowrap lead-cell">{date(l.date, locale)}</td>
                      <td className="desc-cell">
                        {describe(l)}
                        {l.commission ? (
                          <small className="muted block">
                            {t('commission')} {money(l.commission, locale)}
                          </small>
                        ) : null}
                        {l.tax && Number(l.tax) > 0 ? (
                          <small className="muted block">
                            {t('gross')} {money(l.gross!, locale)} · {t('tax')} −{money(l.tax, locale)}
                          </small>
                        ) : null}
                      </td>
                      <td className={`num ${Number(l.amount) < 0 ? 'neg' : 'pos'}`} data-label={t('amountCol')}>{money(l.amount, locale)}</td>
                      <td className="num" data-label={t('balance')}>{money(l.balance, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <h3>{t('holdingsAtEnd')}</h3>
          {stmt.holdings.length === 0 ? <p className="muted">{t('noHoldings')}</p> : null}
          <ul className="list">
            {stmt.holdings.map((h) => (
              <li key={h.isin} className="row static">
                <span>
                  <strong>{locale === 'ar' ? h.nameAr : h.nameEn}</strong>
                  <span className="muted">{h.maturityDate ? `${t('matures')} ${date(h.maturityDate, locale)}` : ''}</span>
                </span>
                <span>{nominal(h.nominal, locale)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
