/**
 * Seed: one Agyal operator, one demo broker, two simulated FIX banks and demo
 * instruments; optionally demo staff. Idempotent.
 *
 * Environment (all optional locally; set them for a hosted demo):
 *   ADMIN_EMAIL, ADMIN_MOBILE, ADMIN_PASSWORD  platform admin sign-in
 *   SEED_DEMO_STAFF=false                       skip the *@demo-broker.example
 *                                               staff (add real staff in the
 *                                               admin console instead)
 *
 * Names and ISINs are demo data.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto.util';
import { DEFAULT_TENANT_CONFIG } from '../src/common/tenant-config';
import { PUBLIC_DEMO_SLUG } from '../src/domain/campaign';
import { withCheckDigit as isin } from '../src/domain/isin';
import { depositEntry } from '../src/domain/ledger-rules';
import { LedgerService } from '../src/modules/ledger/ledger.service';

const prisma = new PrismaClient();

export const DEMO_PASSWORD = 'Demo-Pass-2026!';
/** A ready-to-use investor login printed on the public proposal page (DEMO_LOGINS echoes its code). */
const DEMO_CLIENT_EMAIL = 'investor@demo-broker.example';
const DEMO_CLIENT_CASH = '500000'; // EGP available to trade in the demo
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@agyal.local').toLowerCase();
const ADMIN_MOBILE = process.env.ADMIN_MOBILE ?? '01000000000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? DEMO_PASSWORD;
const SEED_DEMO_STAFF = process.env.SEED_DEMO_STAFF !== 'false';
/** A funded demo investor for the public proposal page. Off in the e2e (it asserts tenant balances). */
const SEED_DEMO_CLIENT = SEED_DEMO_STAFF && process.env.SEED_DEMO_CLIENT !== 'false';

if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
  throw new Error('Set ADMIN_PASSWORD (and ADMIN_EMAIL, ADMIN_MOBILE) to seed a hosted environment');
}

function inDays(days: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

function inYears(years: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() + years, now.getUTCMonth(), 15));
}

async function main() {
  // --- Platform operator ------------------------------------------------------------
  if (!(await prisma.user.findFirst({ where: { tenantId: null, email: ADMIN_EMAIL } }))) {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        mobile: ADMIN_MOBILE,
        mobileVerifiedAt: new Date(),
        passwordHash: hashPassword(ADMIN_PASSWORD),
        roles: ['PLATFORM_ADMIN'],
      },
    });
  }

  // --- Banks (simulated FIX counterparties) ----------------------------------------
  const banks = [
    { code: 'SIMBANK', nameEn: 'Simulated Bank A', nameAr: 'البنك التجريبي أ' },
    { code: 'SIMBANK2', nameEn: 'Simulated Bank B', nameAr: 'البنك التجريبي ب' },
  ];
  for (const b of banks) {
    await prisma.bank.upsert({
      where: { code: b.code },
      create: { ...b, connectionMode: 'FIX', fixSenderCompId: 'AGYAL', fixTargetCompId: b.code },
      update: {},
    });
  }

  // --- Demo broker --------------------------------------------------------------------
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-broker' },
    create: {
      slug: 'demo-broker',
      legalNameEn: 'Demo Securities Brokerage S.A.E.',
      legalNameAr: 'ديمو لتداول الأوراق المالية ش.م.م',
      fraLicenseNo: 'DEMO-000',
      branding: {
        tenantSlug: 'demo-broker',
        displayName: { en: 'Demo Securities', ar: 'ديمو للأوراق المالية' },
        logoUrl: '',
        colors: { primary: '#2f5a45', primaryContrast: '#ffffff', accent: '#a8823a' },
        supportEmail: 'support@demo-broker.example',
        legalDocuments: { termsUrl: '#', riskDisclosureUrl: '#', privacyUrl: '#' },
      },
      config: DEFAULT_TENANT_CONFIG as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });
  // Move the demo broker from the old default blue to Ivory & Forest (only if still on the old default).
  const b = tenant.branding as { colors?: { primary?: string } };
  if (b?.colors?.primary === '#0b4f6c') {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { branding: { ...(tenant.branding as object), colors: { primary: '#2f5a45', primaryContrast: '#ffffff', accent: '#a8823a' } } as Prisma.InputJsonValue },
    });
  }

  const staff = [
    { email: 'admin@demo-broker.example', mobile: '01000000001', roles: ['BROKER_ADMIN'] },
    { email: 'compliance@demo-broker.example', mobile: '01000000002', roles: ['BROKER_COMPLIANCE'] },
    { email: 'ops@demo-broker.example', mobile: '01000000003', roles: ['BROKER_OPS'] },
    { email: 'dealer@demo-broker.example', mobile: '01000000004', roles: ['BROKER_DEALER'] },
    { email: 'finance@demo-broker.example', mobile: '01000000005', roles: ['BROKER_FINANCE'] },
  ];
  for (const s of SEED_DEMO_STAFF ? staff : []) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: s.email } },
      create: {
        tenantId: tenant.id,
        email: s.email,
        mobile: s.mobile,
        mobileVerifiedAt: new Date(),
        passwordHash: hashPassword(DEMO_PASSWORD),
        roles: s.roles,
      },
      update: {},
    });
  }

  // --- Ready-to-use demo investor (printed on the public proposal page) ----------------
  // Approved, funded and holding a verified unified code + custody, so a visitor can sign
  // in with the printed credentials and immediately request a live price and buy.
  if (SEED_DEMO_CLIENT && !(await prisma.user.findFirst({ where: { tenantId: tenant.id, email: DEMO_CLIENT_EMAIL } }))) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      const now = new Date();
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: DEMO_CLIENT_EMAIL,
          mobile: '01099999999',
          mobileVerifiedAt: now,
          passwordHash: hashPassword(DEMO_PASSWORD),
          roles: ['CLIENT'],
        },
      });
      const client = await tx.client.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          depositReference: 'DEMO-INVEST-001',
          status: 'ACTIVE',
          fullNameEn: 'Demo Investor',
          fullNameAr: 'مستثمر تجريبي',
          nationalIdLast4: '4567',
          riskRating: 'MEDIUM',
          riskProfile: 'BALANCED',
          kycApprovedAt: now,
          kycReviewDueAt: inDays(365),
        },
      });
      await tx.onboardingApplication.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          completed: ['IDENTITY', 'PROFILE', 'SUITABILITY', 'UNIFIED_CODE', 'AGREEMENTS'],
          ekycResult: { passed: true, faceMatchScore: 0.98, source: 'seed-demo' },
          amlResult: { flag: 'NONE', isPep: false, riskRating: 'MEDIUM', hits: [] },
          suitability: { horizon: '1_3_YEARS', lossTolerance: 'SMALL', experience: 'SOME' },
          submittedAt: now,
          decisionBy: 'seed:auto-approved',
          decisionNote: 'Demo investor account for the public proposal page.',
          decidedAt: now,
        },
      });
      await tx.investorCode.create({
        data: { tenantId: tenant.id, clientId: client.id, code: '12345678', status: 'VERIFIED', source: 'EXISTING_DECLARED' },
      });
      await tx.custodyAccount.createMany({
        data: [
          { tenantId: tenant.id, clientId: client.id, custodian: 'Demo Custodian (MCDR)', accountNumber: 'MCDR-DEMO-001', depository: 'MCDR' },
          { tenantId: tenant.id, clientId: client.id, custodian: 'Simulated Bank A (CBE)', accountNumber: 'CBE-DEMO-001', depository: 'CBE' },
        ],
      });
      // Opening cash via the same double-entry path the app uses to confirm a deposit.
      await new LedgerService().post(tx, tenant.id, 'DEPOSIT', `seed-demo-${client.id}`, depositEntry(client.id, DEMO_CLIENT_CASH));
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
    for (const code of ['SIMBANK', 'SIMBANK2']) {
      const bank = await tx.bank.findUniqueOrThrow({ where: { code } });
      await tx.brokerBankRelationship.upsert({
        where: { tenantId_bankId: { tenantId: tenant.id, bankId: bank.id } },
        create: { tenantId: tenant.id, bankId: bank.id, brokerAccountAtBank: `DEMO-${code}` },
        update: {},
      });
    }
  });

  // --- Demo instruments ----------------------------------------------------------------
  const tbill = { type: 'TREASURY_BILL' as const, issuer: 'Ministry of Finance', depository: 'CBE' as const, minQty: '25000', qtyIncrement: '25000' };
  const instruments = [
    { ...tbill, isin: isin('EGT91DEMO01'), nameEn: '91-day Treasury Bill (demo)', nameAr: 'أذون خزانة ٩١ يوم (تجريبي)', maturityDate: inDays(91) },
    { ...tbill, isin: isin('EGT182DEMO1'), nameEn: '182-day Treasury Bill (demo)', nameAr: 'أذون خزانة ١٨٢ يوم (تجريبي)', maturityDate: inDays(182) },
    { ...tbill, isin: isin('EGT364DEMO1'), nameEn: '364-day Treasury Bill (demo)', nameAr: 'أذون خزانة ٣٦٤ يوم (تجريبي)', maturityDate: inDays(364) },
    {
      isin: isin('EGTB3YDEMO1'), type: 'TREASURY_BOND' as const, issuer: 'Ministry of Finance',
      nameEn: '3-year Treasury Bond 22% (demo)', nameAr: 'سندات خزانة ٣ سنوات ٢٢٪ (تجريبي)',
      couponRate: '0.22', couponFreq: 2, maturityDate: inYears(3), depository: 'MCDR' as const,
      minQty: '1000', qtyIncrement: '1000',
    },
    {
      isin: isin('EGCBDEMOLS1'), type: 'CORPORATE_BOND' as const, issuer: 'Demo Leasing Co.',
      nameEn: 'Demo Leasing 2-year Bond 26% (demo)', nameAr: 'سندات ديمو للتأجير سنتين ٢٦٪ (تجريبي)',
      couponRate: '0.26', couponFreq: 4, maturityDate: inYears(2), depository: 'MCDR' as const,
      minQty: '1000', qtyIncrement: '1000',
    },
    {
      isin: isin('EGSKDEMOSK1'), type: 'SUKUK' as const, issuer: 'Demo Real Estate Co.',
      nameEn: 'Demo Real Estate 5-year Sukuk 24% (demo)', nameAr: 'صكوك ديمو العقارية ٥ سنوات ٢٤٪ (تجريبي)',
      couponRate: '0.24', couponFreq: 2, maturityDate: inYears(5), depository: 'MCDR' as const,
      minQty: '1000', qtyIncrement: '1000',
    },
  ];
  for (const i of instruments) {
    // Create only: never move an existing instrument's maturity (clients may hold it).
    await prisma.instrument.upsert({ where: { isin: i.isin }, create: i, update: {} });
  }

  // --- Indicative rates (same demo yields as the bank simulator; real quotes replace them) ---
  const demoYield: Record<string, number> = { TREASURY_BILL: 0.265, TREASURY_BOND: 0.245, CORPORATE_BOND: 0.285, SUKUK: 0.275 };
  for (const i of instruments) {
    const offer = demoYield[i.type];
    await prisma.indicativeRate.upsert({
      where: { isin: i.isin },
      create: { isin: i.isin, offerYield: offer.toFixed(6), bidYield: (offer + 0.003).toFixed(6), source: 'SEED' },
      update: {},
    });
  }

  // --- Demo platform news (shown on every client's home page) ------------------------
  await prisma.$transaction(async (tx) => {
    // Platform news has no tenant: written as the platform (RLS bypass).
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    if ((await tx.announcement.count({ where: { tenantId: null } })) > 0) return;
    await tx.announcement.createMany({
      data: [
        {
          titleEn: 'Welcome to your fixed-income app (demo)',
          titleAr: 'مرحبًا بك في تطبيق أدوات الدخل الثابت (تجريبي)',
          bodyEn: 'Browse treasury bills, bonds and sukuk, see what you would earn after tax and fees, and buy at the best price from several banks.',
          bodyAr: 'تصفّح أذون وسندات الخزانة والصكوك، واعرف عائدك بعد الضرائب والرسوم، واشترِ بأفضل سعر من عدة بنوك.',
        },
        {
          titleEn: 'How your papers are held (demo)',
          titleAr: 'كيف تُحفظ أوراقك المالية (تجريبي)',
          bodyEn: 'Every paper you buy is registered under your own unified code at the Central Bank of Egypt or MCDR, not in the name of your broker or the platform.',
          bodyAr: 'كل ورقة مالية تشتريها تُسجَّل باسمك وبكودك الموحد لدى البنك المركزي المصري أو شركة مصر للمقاصة، وليس باسم الوسيط أو المنصة.',
        },
      ],
    });
  });

  // --- Public demo tenant ---------------------------------------------------------------
  // Where accounts opened from the campaign landing page live. Deliberately NOT
  // `demo-broker`: that tenant's console credentials are printed on the public
  // proposal page, so anyone could sign in and read the names and emails of
  // everyone who signed up. This one's staff logins are published nowhere.
  const publicDemo = await prisma.tenant.upsert({
    where: { slug: PUBLIC_DEMO_SLUG },
    create: {
      slug: PUBLIC_DEMO_SLUG,
      legalNameEn: 'Agyal Demo (simulated)',
      legalNameAr: 'أجيال — نسخة تجريبية',
      branding: {
        tenantSlug: PUBLIC_DEMO_SLUG,
        displayName: { en: 'Agyal Demo', ar: 'أجيال التجريبية' },
        logoUrl: '',
        colors: { primary: '#2f5a45', primaryContrast: '#ffffff', accent: '#a8823a' },
        supportEmail: 'hello@agyal.net',
        legalDocuments: { termsUrl: '#', riskDisclosureUrl: '#', privacyUrl: '#' },
      },
      config: DEFAULT_TENANT_CONFIG as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });
  // Same bank links as the demo broker, so pricing and RFQ work for demo accounts.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${publicDemo.id}, true)`;
    for (const code of banks.map((x) => x.code)) {
      const bank = await tx.bank.findUniqueOrThrow({ where: { code } });
      await tx.brokerBankRelationship.upsert({
        where: { tenantId_bankId: { tenantId: publicDemo.id, bankId: bank.id } },
        create: { tenantId: publicDemo.id, bankId: bank.id, brokerAccountAtBank: `PUBLICDEMO-${code}` },
        update: {},
      });
    }
  });

  console.log(`Seeded tenant ${tenant.slug}, ${banks.length} banks, ${instruments.length} instruments.`);
  console.log(`Public demo tenant: ${publicDemo.slug} (campaign signups; no published logins)`);
  console.log(`Platform admin: ${ADMIN_EMAIL}`);
  if (SEED_DEMO_STAFF) console.log(`Demo staff${SEED_DEMO_CLIENT ? ` + investor (${DEMO_CLIENT_EMAIL})` : ''} seeded; demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
