/**
 * Local development seed: one Agyal operator, one demo broker with staff,
 * two simulated FIX banks, and demo instruments. Idempotent.
 *
 * All names, ISINs and passwords here are demo data for local use only.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto.util';
import { DEFAULT_TENANT_CONFIG } from '../src/common/tenant-config';

const prisma = new PrismaClient();

export const DEMO_PASSWORD = 'Demo-Pass-2026!';

/** ISIN check digit (ISO 6166): letters to numbers, then Luhn. */
function isin(prefix11: string): string {
  const digits = prefix11
    .split('')
    .map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c))
    .join('');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return prefix11 + String((10 - (sum % 10)) % 10);
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
  const adminEmail = 'admin@agyal.local';
  if (!(await prisma.user.findFirst({ where: { tenantId: null, email: adminEmail } }))) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        mobile: '01000000000',
        mobileVerifiedAt: new Date(),
        passwordHash: hashPassword(DEMO_PASSWORD),
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
        colors: { primary: '#0b4f6c', primaryContrast: '#ffffff', accent: '#c28f2c' },
        supportEmail: 'support@demo-broker.example',
        legalDocuments: { termsUrl: '#', riskDisclosureUrl: '#', privacyUrl: '#' },
      },
      config: DEFAULT_TENANT_CONFIG as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });

  const staff = [
    { email: 'admin@demo-broker.example', mobile: '01000000001', roles: ['BROKER_ADMIN'] },
    { email: 'compliance@demo-broker.example', mobile: '01000000002', roles: ['BROKER_COMPLIANCE'] },
    { email: 'ops@demo-broker.example', mobile: '01000000003', roles: ['BROKER_OPS'] },
    { email: 'dealer@demo-broker.example', mobile: '01000000004', roles: ['BROKER_DEALER'] },
    { email: 'finance@demo-broker.example', mobile: '01000000005', roles: ['BROKER_FINANCE'] },
  ];
  for (const s of staff) {
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
    await prisma.instrument.upsert({ where: { isin: i.isin }, create: i, update: { maturityDate: i.maturityDate } });
  }

  console.log(`Seeded tenant ${tenant.slug}, ${banks.length} banks, ${instruments.length} instruments.`);
  console.log(`Demo password for all seeded users: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
