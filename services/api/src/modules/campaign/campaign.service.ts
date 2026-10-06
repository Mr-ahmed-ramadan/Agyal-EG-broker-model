import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { DbService } from '../../common/db.service';
import { EconomicsService } from '../../common/economics.service';
import { bandFor, bandMidpoint, type AmountBand, type SavesIn } from '../../domain/campaign';
import { clientWaterfall, pricingRuleFor } from '../../domain/economics';
import { addBusinessDays, daysBetween } from '../../domain/fixed-income';
import { clientPricePer100, nominalForAmount, projectHolding } from '../../domain/projection';
import { pricingInstrument } from '../instruments/instruments.service';

export interface WaitlistInput {
  name: string;
  email?: string;
  mobile?: string;
  governorate?: string;
  amountBand?: AmountBand;
  savesIn?: SavesIn;
  locale: string;
  source?: string;
  campaign?: string;
}

/** Settlement for the public calculator: the platform default, not a broker's. */
const SETTLEMENT_DAYS = 2;

/**
 * The public face of the awareness campaign: an educational calculator that
 * needs no account, and a waitlist that records intent rather than identity.
 *
 * Both are deliberately unauthenticated and tenant-free. The calculator runs on
 * the platform's own economics so it never implies a particular broker's
 * pricing, and every figure it returns is indicative.
 */
@Injectable()
export class CampaignService {
  constructor(
    private readonly db: DbService,
    private readonly economics: EconomicsService,
  ) {}

  /**
   * "If I put in X for N days, what do I get?" — answered with the same engine
   * the real product uses, so the campaign can never quote numbers the platform
   * would not honour.
   */
  async calculate(amount: number, tenorDays: number, locale: string) {
    if (!(amount > 0)) throw new BadRequestException('Amount must be positive');
    const economics = await this.economics.platformDefaults();
    const rule = pricingRuleFor(economics);
    const settlDate = addBusinessDays(new Date(), SETTLEMENT_DAYS);

    // The live paper whose remaining term best matches the tenor asked about.
    const instruments = await this.db.asSystem((tx) =>
      tx.instrument.findMany({ where: { maturityDate: { gt: settlDate } } }),
    );
    if (instruments.length === 0) throw new NotFoundException('No paper is available to price yet');
    const withTerm = instruments.map((i) => ({ i, days: daysBetween(settlDate, i.maturityDate) }));
    const best = withTerm.reduce((a, b) => (Math.abs(b.days - tenorDays) < Math.abs(a.days - tenorDays) ? b : a));
    const instrument = best.i;

    const rate = await this.db.asSystem((tx) => tx.indicativeRate.findUnique({ where: { isin: instrument.isin } }));
    if (rate?.offerYield == null) throw new NotFoundException('No indicative rate is available yet');

    const termDays = best.days;
    const breakdown = clientWaterfall(economics, instrument.type, Number(rate.offerYield), termDays);
    const clientYield = breakdown.clientYield!;
    const taxRate = economics.taxRates[instrument.type];
    const p = pricingInstrument(instrument);

    const px = clientPricePer100(p, clientYield, settlDate);
    const nominal = nominalForAmount(
      new Decimal(amount),
      px.clean + px.accrued,
      rule,
      instrument.minQty.toString(),
      instrument.qtyIncrement.toString(),
    );
    if (!nominal) {
      throw new BadRequestException(`The minimum for this paper is ${instrument.minQty.toFixed(0)} face value`);
    }
    const projection = projectHolding({ instrument: p, settlDate, clientYield, nominal, rule, taxRate });

    // Demand signal only: the band, never the figure typed.
    await this.db.asSystem((tx) =>
      tx.calculatorUse.create({ data: { amountBand: bandFor(amount), tenorDays: termDays, locale } }),
    );

    return {
      indicative: true,
      asOf: rate.asOf,
      paper: { type: instrument.type, nameEn: instrument.nameEn, nameAr: instrument.nameAr, termDays },
      taxRate,
      returnBreakdown: breakdown,
      ...projection,
    };
  }

  /** Someone asking to be told when the service opens. Intent only. */
  async joinWaitlist(input: WaitlistInput, ip?: string) {
    if (!input.email && !input.mobile) {
      throw new BadRequestException('An email address or a mobile number is needed so we can reach you');
    }
    const existing = await this.db.asSystem((tx) =>
      tx.waitlistSignup.findFirst({
        where: {
          OR: [
            ...(input.email ? [{ email: input.email }] : []),
            ...(input.mobile ? [{ mobile: input.mobile }] : []),
          ],
        },
      }),
    );
    // Already on the list: say yes, store nothing twice.
    if (existing) return { joined: true, alreadyOn: true };

    await this.db.asSystem((tx) =>
      tx.waitlistSignup.create({
        data: {
          name: input.name,
          email: input.email ?? null,
          mobile: input.mobile ?? null,
          governorate: input.governorate ?? null,
          amountBand: input.amountBand ?? null,
          savesIn: input.savesIn ?? null,
          locale: input.locale,
          consent: true,
          consentAt: new Date(),
          source: input.source ?? null,
          campaign: input.campaign ?? null,
          ip: ip ?? null,
        },
      }),
    );
    return { joined: true, alreadyOn: false };
  }

  /**
   * The demand picture, for broker conversations and the FRA file: how many
   * people, where they are, how much they intend to invest and what they hold
   * today. Aggregates only — no figure here identifies anyone.
   */
  async demand() {
    const [signups, calcUses] = await this.db.asSystem((tx) =>
      Promise.all([
        tx.waitlistSignup.findMany({ orderBy: { createdAt: 'desc' } }),
        tx.calculatorUse.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 }),
      ]),
    );

    const tally = <T extends string>(rows: (T | null)[]): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const r of rows) if (r) out[r] = (out[r] ?? 0) + 1;
      return out;
    };

    const banded = signups.map((s) => s.amountBand as AmountBand | null).filter(Boolean) as AmountBand[];
    const intended = banded.reduce((sum, b) => sum + bandMidpoint(b), 0);

    return {
      signups: {
        total: signups.length,
        withAmountBand: banded.length,
        /** Rough size of the demand the list represents, from band midpoints */
        estimatedIntendedEgp: intended,
        byGovernorate: tally(signups.map((s) => s.governorate)),
        byAmountBand: tally(signups.map((s) => s.amountBand)),
        bySavesIn: tally(signups.map((s) => s.savesIn)),
        bySource: tally(signups.map((s) => s.source)),
        byLocale: tally(signups.map((s) => s.locale)),
        recent: signups.slice(0, 50).map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          mobile: s.mobile,
          governorate: s.governorate,
          amountBand: s.amountBand,
          savesIn: s.savesIn,
          source: s.source,
          createdAt: s.createdAt,
        })),
      },
      calculator: {
        total: calcUses.length,
        byAmountBand: tally(calcUses.map((c) => c.amountBand)),
        byTenor: tally(calcUses.map((c) => String(c.tenorDays))),
      },
    };
  }
}
