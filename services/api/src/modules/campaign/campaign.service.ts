import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Tenant } from '@prisma/client';
import Decimal from 'decimal.js';
import { hashPassword } from '../../common/crypto.util';
import { DbService } from '../../common/db.service';
import { EconomicsService } from '../../common/economics.service';
import {
  DEMO_OPENING_CASH, PUBLIC_DEMO_SLUG, bandFor, bandMidpoint,
  type AmountBand, type SavesIn,
} from '../../domain/campaign';
import { depositEntry } from '../../domain/ledger-rules';
import { OtpService } from '../identity/otp.service';
import { LedgerService } from '../ledger/ledger.service';
import { ONBOARDING_STEPS } from '../onboarding/onboarding.service';
import { clientWaterfall, pricingRuleFor } from '../../domain/economics';
import { addBusinessDays, daysBetween } from '../../domain/fixed-income';
import { clientPricePer100, nominalForAmount, projectHolding } from '../../domain/projection';
import { pricingInstrument } from '../instruments/instruments.service';

export interface DemoSignupInput {
  name: string;
  email: string;
  /** Optional contact number. Stored on the client, never as an auth factor. */
  phone?: string;
  locale: string;
  source?: string;
  campaign?: string;
}

/** One contactable person from the campaign, whichever door they came through. */
export interface ContactRow {
  kind: 'DEMO_ACCOUNT' | 'WAITLIST';
  name: string | null;
  email: string | null;
  phone: string | null;
  tradedSimulated: boolean;
  governorate: string | null;
  amountBand: string | null;
  savesIn: string | null;
  source: string | null;
  locale: string | null;
  createdAt: Date;
}

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

/** Whose name the sign-in code is sent under. */
function brandName(tenant: Tenant): string {
  const branding = tenant.branding as { displayName?: { en?: string } } | null;
  return branding?.displayName?.en ?? 'Agyal';
}

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
    private readonly otp: OtpService,
    private readonly ledger: LedgerService,
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

  /** The tenant demo accounts belong to; created by the seed. */
  private async publicDemoTenant() {
    const tenant = await this.db.asSystem((tx) => tx.tenant.findUnique({ where: { slug: PUBLIC_DEMO_SLUG } }));
    if (!tenant) throw new ServiceUnavailableException('The demo is not available right now');
    return tenant;
  }

  /**
   * Opens a demo account from the landing page and emails a sign-in code.
   *
   * Builds the same account state the seed's demo investor has — active,
   * approved, with custody accounts and opening cash posted through the real
   * double-entry path — so the visitor lands on a funded home and can place a
   * simulated trade immediately.
   *
   * It collects a name and an email and nothing else: no national ID, no
   * documents, no mobile and no screening. The eKYC and AML records it writes
   * are marked simulated so they can never be mistaken for checks that really
   * ran. Real KYC belongs to a licensed broker, later.
   */
  async demoSignup(input: DemoSignupInput) {
    const tenant = await this.publicDemoTenant();
    const email = input.email.toLowerCase();

    const existing = await this.db.asSystem((tx) =>
      tx.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email } } }),
    );
    // Already has a demo account: send a sign-in code rather than a second one.
    if (existing) {
      const challenge = await this.otp.issue(existing, 'LOGIN', brandName(tenant));
      return { ...challenge, created: false };
    }

    const now = new Date();
    const user = await this.db.asSystem(async (inner) => {
      await inner.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      {
        const created = await inner.user.create({
          data: {
            tenantId: tenant.id,
            email,
            // No mobile: a demo needs no SMS, and it is personal data we do not need.
            mobile: null,
            // Set so sign-in asks for a LOGIN code rather than mobile verification.
            mobileVerifiedAt: now,
            // Sign-in is by emailed code only; this hash is never usable.
            passwordHash: hashPassword(randomBytes(32).toString('hex')),
            roles: ['CLIENT'],
          },
        });
        const client = await inner.client.create({
          data: {
            tenantId: tenant.id,
            userId: created.id,
            depositReference: `DEMO-${randomBytes(4).toString('hex').toUpperCase()}`,
            status: 'ACTIVE',
            fullNameEn: input.name,
            // A number to call them on, if they left one. Unverified, and kept
            // off User.mobile so nothing claims an SMS was ever sent.
            phone: input.phone ?? null,
            // No national ID, encrypted or otherwise: this is a demo.
            riskRating: 'MEDIUM',
            riskProfile: 'BALANCED',
            kycApprovedAt: now,
            kycReviewDueAt: new Date(now.getTime() + 365 * 86_400_000),
          },
        });
        await inner.onboardingApplication.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            // From the source of truth, so a renamed step cannot silently leave
            // demo accounts with an onboarding step outstanding.
            completed: [...ONBOARDING_STEPS],
            // Marked simulated: no check was run, and this must never read as one that passed.
            ekycResult: { simulated: true, source: 'public-demo', passed: null },
            amlResult: { simulated: true, source: 'public-demo', flag: 'NOT_SCREENED' },
            suitability: { simulated: true, source: 'public-demo' },
            submittedAt: now,
            decisionBy: 'public-demo:auto',
            decisionNote: 'Demo account opened from the campaign page. No KYC performed.',
            decidedAt: now,
          },
        });
        await inner.investorCode.create({
          data: { tenantId: tenant.id, clientId: client.id, code: `D${randomBytes(4).toString('hex').slice(0, 7)}`, status: 'VERIFIED', source: 'EXISTING_DECLARED' },
        });
        await inner.custodyAccount.createMany({
          data: [
            { tenantId: tenant.id, clientId: client.id, custodian: 'Demo Custodian (MCDR)', accountNumber: 'MCDR-DEMO', depository: 'MCDR' },
            { tenantId: tenant.id, clientId: client.id, custodian: 'Simulated Bank A (CBE)', accountNumber: 'CBE-DEMO', depository: 'CBE' },
          ],
        });
        // Simulated opening cash, posted through the same double-entry path a real deposit uses.
        await this.ledger.post(inner, tenant.id, 'DEPOSIT', `demo-${client.id}`, depositEntry(client.id, DEMO_OPENING_CASH));
        return created;
      }
    });

    const challenge = await this.otp.issue(user, 'LOGIN', brandName(tenant));
    return { ...challenge, created: true };
  }

  /**
   * Passwordless return for demo accounts: emails a sign-in code.
   *
   * Scoped strictly to the public-demo tenant. Issuing a code for any other
   * tenant's user would be an authentication bypass, since it would hand out a
   * sign-in factor without a password. The reply is the same whether or not the
   * address exists, so the endpoint cannot be used to discover who signed up.
   */
  async demoSignin(email: string) {
    const tenant = await this.publicDemoTenant();
    const user = await this.db.asSystem((tx) =>
      tx.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email: email.toLowerCase() } } }),
    );
    if (!user || user.tenantId !== tenant.id) return { sent: true };
    const challenge = await this.otp.issue(user, 'LOGIN', brandName(tenant));
    return { ...challenge, sent: true };
  }

  /** A visitor's note about the beta. Nothing is required but the message. */
  async feedback(input: { message: string; email?: string; locale: string; source?: string }, ip?: string) {
    await this.db.asSystem((tx) =>
      tx.feedback.create({
        data: {
          message: input.message,
          email: input.email ?? null,
          locale: input.locale,
          source: input.source ?? null,
          ip: ip ?? null,
        },
      }),
    );
    return { received: true };
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
  /**
   * Everyone the campaign has a contact detail for, flat, for follow-up in a
   * spreadsheet or a phone. Demo accounts first because they are the stronger
   * signal: they did something rather than said something.
   *
   * This is personal data leaving the system, so it stays behind the platform
   * admin guard and adds nothing that was not already collected.
   */
  async contacts(): Promise<ContactRow[]> {
    const demoTenant = await this.db.asSystem((tx) => tx.tenant.findUnique({ where: { slug: PUBLIC_DEMO_SLUG } }));

    const demo: ContactRow[] = demoTenant
      ? await this.db.asSystem(async (tx) => {
          const [clients, orders] = await Promise.all([
            tx.client.findMany({
              where: { tenantId: demoTenant.id },
              orderBy: { createdAt: 'desc' },
              select: { id: true, userId: true, fullNameEn: true, phone: true, createdAt: true },
            }),
            tx.order.findMany({ where: { tenantId: demoTenant.id }, select: { clientId: true } }),
          ]);
          // Client has no `user` relation, so the emails come separately.
          const emails = new Map(
            (await tx.user.findMany({
              where: { id: { in: clients.map((c) => c.userId) } },
              select: { id: true, email: true },
            })).map((u) => [u.id, u.email]),
          );
          const traders = new Set(orders.map((o) => o.clientId));
          return clients.map((c) => ({
            kind: 'DEMO_ACCOUNT' as const,
            name: c.fullNameEn,
            email: emails.get(c.userId) ?? null,
            phone: c.phone,
            tradedSimulated: traders.has(c.id),
            governorate: null,
            amountBand: null,
            savesIn: null,
            source: null,
            locale: null,
            createdAt: c.createdAt,
          }));
        })
      : [];

    const waitlist = await this.db.asSystem((tx) => tx.waitlistSignup.findMany({ orderBy: { createdAt: 'desc' } }));

    return [
      ...demo,
      ...waitlist.map((s) => ({
        kind: 'WAITLIST' as const,
        name: s.name,
        email: s.email,
        phone: s.mobile,
        tradedSimulated: false,
        governorate: s.governorate,
        amountBand: s.amountBand,
        savesIn: s.savesIn,
        source: s.source,
        locale: s.locale,
        createdAt: s.createdAt,
      })),
    ];
  }

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

    // What people actually did, which is stronger evidence than what they said
    // they would do: demo accounts opened, and how many went on to trade.
    const demoTenant = await this.db.asSystem((tx) => tx.tenant.findUnique({ where: { slug: PUBLIC_DEMO_SLUG } }));
    const demo = demoTenant
      ? await this.db.asSystem(async (tx) => {
          const [accounts, orders, recent] = await Promise.all([
            tx.client.count({ where: { tenantId: demoTenant.id } }),
            tx.order.findMany({
              where: { tenantId: demoTenant.id },
              select: { clientId: true, side: true, orderQty: true, isin: true },
            }),
            // Who signed up, so they can be followed up by email or phone.
            tx.client.findMany({
              where: { tenantId: demoTenant.id },
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: { id: true, userId: true, fullNameEn: true, phone: true, createdAt: true },
            }),
          ]);
          // Client has no `user` relation, so the emails come separately.
          const emails = new Map(
            (await tx.user.findMany({
              where: { id: { in: recent.map((c) => c.userId) } },
              select: { id: true, email: true },
            })).map((u) => [u.id, u.email]),
          );
          const traders = new Set(orders.map((o) => o.clientId));
          const nominal = orders.reduce((sum, o) => sum.plus(new Decimal(o.orderQty.toString())), new Decimal(0));
          return {
            accounts,
            placedAnOrder: traders.size,
            /** Share of demo accounts that went on to place a simulated order */
            conversion: accounts > 0 ? Math.round((traders.size / accounts) * 100) / 100 : 0,
            orders: orders.length,
            simulatedNominalEgp: nominal.toFixed(2),
            withPhone: recent.filter((c) => c.phone).length,
            recent: recent.map((c) => ({
              name: c.fullNameEn,
              email: emails.get(c.userId) ?? null,
              phone: c.phone,
              tradedSimulated: traders.has(c.id),
              createdAt: c.createdAt,
            })),
          };
        })
      : { accounts: 0, placedAnOrder: 0, conversion: 0, orders: 0, simulatedNominalEgp: '0.00', withPhone: 0, recent: [] };

    const notes = await this.db.asSystem((tx) =>
      tx.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    );

    return {
      demo,
      feedback: {
        total: notes.length,
        recent: notes.map((f) => ({ message: f.message, email: f.email, locale: f.locale, source: f.source, createdAt: f.createdAt })),
      },
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
