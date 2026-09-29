import { useApp } from '../context';
import { fill, percent } from '../lib/format';

export interface Breakdown {
  detailed: boolean;
  marketYield?: number;
  custody?: number;
  brokerMargin?: number;
  platformMargin?: number;
  clientYield?: number;
  taxRate?: number;
  tax?: number;
  netYield?: number;
  depositRate?: number;
  vsDeposit?: number;
  belowDeposit?: boolean;
}

/** Market yield → custody, broker and platform margins → before tax → tax → net, vs a deposit. */
export function ReturnBreakdown({ b }: { b: Breakdown }) {
  const { t, locale, tenant } = useApp();
  const p = (v?: number) => percent(v ?? 0, locale);
  return (
    <div className="breakdown">
      <h3>{t('howBuilt')}</h3>
      <table className="wf">
        <tbody>
          {b.detailed ? (
            <>
              <tr><td>{t('wf_market')}</td><td>{p(b.marketYield)}</td></tr>
              <tr><td>{t('wf_custody')}</td><td>−{p(b.custody)}</td></tr>
              <tr><td>{fill(t('wf_broker'), { broker: tenant.branding.displayName[locale] })}</td><td>−{p((b.brokerMargin ?? 0) + (b.platformMargin ?? 0))}</td></tr>
            </>
          ) : null}
          <tr className="sub"><td>{t('wf_client')}</td><td>{p(b.clientYield)}</td></tr>
          <tr><td>{fill(t('wf_tax'), { pct: percent(b.taxRate ?? 0, locale) })}</td><td>−{p(b.tax)}</td></tr>
          <tr className="sub"><td>{t('wf_net')}</td><td>{p(b.netYield)}</td></tr>
          <tr><td>{t('wf_deposit')}</td><td>{p(b.depositRate)}</td></tr>
        </tbody>
      </table>
      <p className={b.belowDeposit ? 'wf-note' : 'wf-note good'}>
        {fill(t(b.belowDeposit ? 'wf_behind' : 'wf_ahead'), { pct: percent(Math.abs(b.vsDeposit ?? 0), locale) })}
      </p>
      <p className="muted small">{t('wf_depositNote')}</p>
    </div>
  );
}
