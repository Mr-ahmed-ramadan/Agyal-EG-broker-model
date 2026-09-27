import { useApp } from '../context';
import { date, money, nominal, percent, price } from '../lib/format';

export interface ProjectionPayment {
  type: 'COUPON' | 'REDEMPTION';
  paymentDate: string;
  gross: string;
  interest: string;
  tax: string;
  net: string;
}

export interface Projection {
  settlDate: string;
  maturityDate: string;
  termDays: number;
  nominal: string;
  clientCleanPx: string;
  clientYield: string;
  principal: string;
  accruedInterest: string;
  commission: string;
  totalCost: string;
  payments: ProjectionPayment[];
  totalReceivedGross: string;
  totalInterest: string;
  totalTax: string;
  totalReceivedNet: string;
  priceGain: string;
  netProfit: string;
  netAnnualReturn: string;
}

/** Summary cards: pay / get back / profit / annual return. */
export function ProjectionSummary({ p }: { p: Projection }) {
  const { t, locale } = useApp();
  return (
    <div className="summary">
      <div>
        <small>{t('youPay')}</small>
        <strong>{money(p.totalCost, locale)}</strong>
      </div>
      <div>
        <small>{t('youGetBack')}</small>
        <strong>{money(p.totalReceivedNet, locale)}</strong>
      </div>
      <div className="good">
        <small>{t('netProfit')}</small>
        <strong>{money(p.netProfit, locale)}</strong>
      </div>
      <div className="good">
        <small>{t('netAnnual')}</small>
        <strong>{percent(p.netAnnualReturn, locale)}</strong>
      </div>
      <p className="muted wide">
        {t('heldToMaturity')} {date(p.maturityDate, locale)} · {t('youBuyFace')} {nominal(p.nominal, locale)}
      </p>
    </div>
  );
}

/** What the client pays, and every payment until maturity with tax. */
export function ProjectionDetail({ p }: { p: Projection }) {
  const { t, locale } = useApp();
  return (
    <>
      <h3>{t('costBreakdown')}</h3>
      <dl>
        <dt>
          {t('cleanPrice')} ({price(p.clientCleanPx, locale)} / 100)
        </dt>
        <dd>{money(p.principal, locale)}</dd>
        {Number(p.accruedInterest) > 0 ? (
          <>
            <dt>{t('accrued')}</dt>
            <dd>{money(p.accruedInterest, locale)}</dd>
          </>
        ) : null}
        <dt>{t('commission')}</dt>
        <dd>{money(p.commission, locale)}</dd>
        <dt className="total">{t('youPay')}</dt>
        <dd className="total">{money(p.totalCost, locale)}</dd>
      </dl>
      <h3>{t('schedule')}</h3>
      <div className="table-wrap">
        <table className="table stack">
          <thead>
            <tr>
              <th>{t('payDate')}</th>
              <th>{t('payType')}</th>
              <th className="num">{t('gross')}</th>
              <th className="num">{t('tax')}</th>
              <th className="num">{t('net')}</th>
            </tr>
          </thead>
          <tbody>
            {p.payments.map((x, k) => (
              <tr key={k}>
                <td className="nowrap lead-cell" data-label={t('payDate')}>{date(x.paymentDate, locale)}<span className="show-stacked"> · {t(`inc_${x.type}`)}</span></td>
                <td className="hide-stacked">{t(`inc_${x.type}`)}</td>
                <td className="num" data-label={t('gross')}>{money(x.gross, locale)}</td>
                <td className="num" data-label={t('tax')}>{Number(x.tax) > 0 ? `−${money(x.tax, locale)}` : '–'}</td>
                <td className="num" data-label={t('net')}>{money(x.net, locale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="lead-cell">{t('totals')}</td>
              <td className="num" data-label={t('gross')}>{money(p.totalReceivedGross, locale)}</td>
              <td className="num" data-label={t('tax')}>−{money(p.totalTax, locale)}</td>
              <td className="num" data-label={t('net')}>{money(p.totalReceivedNet, locale)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {Number(p.priceGain) !== 0 ? (
        <p className="muted">
          {t('priceGain')}: {money(p.priceGain, locale)}
        </p>
      ) : null}
    </>
  );
}
