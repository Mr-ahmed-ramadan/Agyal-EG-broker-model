import type { InstrumentType, PricingRule } from './pricing';

/**
 * How a client's return is built from the market yield (ADR 0008):
 *
 *   market yield (bank quote or indicative)
 *   - custody & operations
 *   - broker margin
 *   - platform (Agyal) margin
 *   = client yield before tax
 *   - tax on the yield
 *   = client net yield, compared with a bank deposit of the same term.
 *
 * All deductions are in yield basis points and work against the client on
 * both sides (lower yield when buying, higher yield when selling). An optional
 * commission per trade goes to the broker.
 */

export type TenorBucket = 'UP_TO_3M' | 'UP_TO_6M' | 'UP_TO_1Y' | 'OVER_1Y';
export const TENOR_BUCKETS: TenorBucket[] = ['UP_TO_3M', 'UP_TO_6M', 'UP_TO_1Y', 'OVER_1Y'];

export interface Economics {
  custodyBps: number;
  brokerMarginBps: number;
  platformMarginBps: number;
  /** Optional per-trade commission to the broker, bps of face value */
  commissionBps: number;
  commissionMin: string;
  /** Tax on interest by paper type, as a fraction */
  taxRates: Record<InstrumentType, number>;
  /** Bank deposit rates by term, as annual fractions (compared net: deposit interest is tax-exempt for individuals) */
  depositRates: Record<TenorBucket, number>;
  /** Show clients the full breakdown (custody, broker, platform) or only before-tax, tax and net */
  showBreakdownToClients: boolean;
  /** Guardrail: total yield deduction may not exceed this */
  maxTotalDeductionBps: number;
}

export const DEFAULT_ECONOMICS: Economics = {
  custodyBps: 5,
  brokerMarginBps: 50,
  platformMarginBps: 100,
  commissionBps: 0,
  commissionMin: '0.00',
  taxRates: { TREASURY_BILL: 0.2, TREASURY_BOND: 0.2, CORPORATE_BOND: 0.2, SUKUK: 0.2 },
  depositRates: { UP_TO_3M: 0.17, UP_TO_6M: 0.17, UP_TO_1Y: 0.17, OVER_1Y: 0.17 },
  showBreakdownToClients: true,
  maxTotalDeductionBps: 300,
};

export type EconomicsOverrides = Partial<Omit<Economics, 'taxRates' | 'depositRates'>> & {
  taxRates?: Partial<Record<InstrumentType, number>>;
  depositRates?: Partial<Record<TenorBucket, number>>;
};

/** Platform defaults with a broker's overrides on top. */
export function mergeEconomics(base: Economics, ...overrides: (EconomicsOverrides | null | undefined)[]): Economics {
  let out: Economics = { ...base, taxRates: { ...base.taxRates }, depositRates: { ...base.depositRates } };
  for (const o of overrides) {
    if (!o) continue;
    const { taxRates, depositRates, ...rest } = o;
    const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== null));
    out = {
      ...out,
      ...defined,
      taxRates: { ...out.taxRates, ...(taxRates ?? {}) },
      depositRates: { ...out.depositRates, ...(depositRates ?? {}) },
    };
  }
  return out;
}

export function totalDeductionBps(e: Pick<Economics, 'custodyBps' | 'brokerMarginBps' | 'platformMarginBps'>): number {
  return e.custodyBps + e.brokerMarginBps + e.platformMarginBps;
}

/** Problems with a set of economics (empty when valid). */
export function economicsProblems(e: Economics): string[] {
  const out: string[] = [];
  const bps = (v: number, name: string) => {
    if (!Number.isInteger(v) || v < 0) out.push(`${name} must be a whole number of basis points, 0 or more`);
  };
  bps(e.custodyBps, 'Custody');
  bps(e.brokerMarginBps, 'Broker margin');
  bps(e.platformMarginBps, 'Platform margin');
  bps(e.commissionBps, 'Commission');
  if (!(Number(e.commissionMin) >= 0)) out.push('Minimum commission must be 0 or more');
  if (totalDeductionBps(e) > e.maxTotalDeductionBps) {
    out.push(`Total deduction ${(totalDeductionBps(e) / 100).toFixed(2)}% is above the ${(e.maxTotalDeductionBps / 100).toFixed(2)}% limit`);
  }
  for (const [k, v] of Object.entries(e.taxRates)) if (!(v >= 0 && v < 1)) out.push(`Tax rate for ${k} must be between 0% and 100%`);
  for (const [k, v] of Object.entries(e.depositRates)) if (!(v >= 0 && v < 1)) out.push(`Deposit rate ${k} must be between 0% and 100%`);
  return out;
}

/** The rule the pricing engine applies: total deduction as markup, plus how it splits. */
export function pricingRuleFor(e: Economics): PricingRule {
  return {
    markupBps: totalDeductionBps(e),
    commissionBps: e.commissionBps,
    commissionMin: e.commissionMin,
    split: { custodyBps: e.custodyBps, brokerMarginBps: e.brokerMarginBps, platformMarginBps: e.platformMarginBps },
  };
}

export function tenorBucket(days: number): TenorBucket {
  if (days <= 92) return 'UP_TO_3M';
  if (days <= 183) return 'UP_TO_6M';
  if (days <= 366) return 'UP_TO_1Y';
  return 'OVER_1Y';
}

export interface Waterfall {
  marketYield: number;
  custody: number;
  brokerMargin: number;
  platformMargin: number;
  clientYield: number;
  taxRate: number;
  tax: number;
  netYield: number;
  depositRate: number;
  vsDeposit: number;
  belowDeposit: boolean;
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Buyer's waterfall from a market (bank offer) yield, for a paper type and term. */
export function waterfall(e: Economics, type: InstrumentType, marketYield: number, termDays: number): Waterfall {
  const custody = e.custodyBps / 10_000;
  const brokerMargin = e.brokerMarginBps / 10_000;
  const platformMargin = e.platformMarginBps / 10_000;
  const clientYield = Math.max(0, marketYield - custody - brokerMargin - platformMargin);
  const taxRate = e.taxRates[type] ?? DEFAULT_ECONOMICS.taxRates[type];
  const tax = clientYield * taxRate;
  const netYield = clientYield - tax;
  const depositRate = e.depositRates[tenorBucket(termDays)];
  return {
    marketYield: r6(marketYield),
    custody: r6(custody),
    brokerMargin: r6(brokerMargin),
    platformMargin: r6(platformMargin),
    clientYield: r6(clientYield),
    taxRate,
    tax: r6(tax),
    netYield: r6(netYield),
    depositRate,
    vsDeposit: r6(netYield - depositRate),
    belowDeposit: netYield < depositRate,
  };
}

/**
 * What a client is shown: the full waterfall when the broker allows it,
 * otherwise only yield before tax, tax, net and the deposit comparison.
 */
export function clientWaterfall(e: Economics, type: InstrumentType, marketYield: number, termDays: number): Partial<Waterfall> & { detailed: boolean } {
  const w = waterfall(e, type, marketYield, termDays);
  if (e.showBreakdownToClients) return { ...w, detailed: true };
  const { clientYield, taxRate, tax, netYield, depositRate, vsDeposit, belowDeposit } = w;
  return { clientYield, taxRate, tax, netYield, depositRate, vsDeposit, belowDeposit, detailed: false };
}
