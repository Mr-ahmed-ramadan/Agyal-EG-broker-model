/**
 * Awareness campaign: intent, never identity.
 *
 * The campaign gauges demand before a licensed broker is signed, so it
 * deliberately collects no national ID, no documents, no bank details and runs
 * no AML screening. KYC is the licensed broker's obligation and happens later,
 * inside the broker's own tenant. Nothing here should ever grow an identity
 * field — see the guard in the e2e suite.
 */

/**
 * The tenant that accounts opened from the campaign landing page belong to.
 *
 * Deliberately NOT `demo-broker`: that tenant's broker-console credentials are
 * printed on the public proposal page so prospects can try the console, which
 * would let anyone sign in and read the name and email of everyone who signed
 * up. This tenant's staff logins are published nowhere.
 */
export const PUBLIC_DEMO_SLUG = 'agyal-demo';

/** Simulated opening balance for a demo account, in EGP. */
export const DEMO_OPENING_CASH = '500000';

/** How much someone intends to start with. Bands, never an exact figure. */
export const AMOUNT_BANDS = [
  'UNDER_10K',
  'FROM_10K_TO_50K',
  'FROM_50K_TO_250K',
  'FROM_250K_TO_1M',
  'OVER_1M',
] as const;
export type AmountBand = (typeof AMOUNT_BANDS)[number];

/** Where their savings sit today — the comparison the product has to beat. */
export const SAVES_IN = ['DEPOSIT', 'CERTIFICATE', 'GOLD', 'NONE', 'OTHER'] as const;
export type SavesIn = (typeof SAVES_IN)[number];

/** Egypt's governorates, for showing brokers where the demand actually is. */
export const GOVERNORATES = [
  'CAIRO', 'GIZA', 'ALEXANDRIA', 'QALYUBIA', 'SHARQIA', 'DAKAHLIA', 'BEHEIRA',
  'MINYA', 'SOHAG', 'ASYUT', 'GHARBIA', 'MONUFIA', 'KAFR_EL_SHEIKH', 'FAYOUM',
  'BENI_SUEF', 'QENA', 'ASWAN', 'LUXOR', 'DAMIETTA', 'ISMAILIA', 'PORT_SAID',
  'SUEZ', 'NORTH_SINAI', 'SOUTH_SINAI', 'MATROUH', 'NEW_VALLEY', 'RED_SEA',
] as const;
export type Governorate = (typeof GOVERNORATES)[number];

/** Tenors the public calculator offers, in days. */
export const CALCULATOR_TENORS = [91, 182, 273, 364] as const;
export type CalculatorTenor = (typeof CALCULATOR_TENORS)[number];

/**
 * Buckets an amount for storage. The calculator records the band rather than
 * the figure typed, so usage is a demand signal and never a financial profile
 * of an identifiable person.
 */
export function bandFor(amount: number): AmountBand {
  if (amount < 10_000) return 'UNDER_10K';
  if (amount < 50_000) return 'FROM_10K_TO_50K';
  if (amount < 250_000) return 'FROM_50K_TO_250K';
  if (amount < 1_000_000) return 'FROM_250K_TO_1M';
  return 'OVER_1M';
}

/** Midpoint of a band, for estimating the demand a waitlist represents. */
export function bandMidpoint(band: AmountBand): number {
  switch (band) {
    case 'UNDER_10K': return 5_000;
    case 'FROM_10K_TO_50K': return 30_000;
    case 'FROM_50K_TO_250K': return 150_000;
    case 'FROM_250K_TO_1M': return 625_000;
    case 'OVER_1M': return 1_000_000;
  }
}
