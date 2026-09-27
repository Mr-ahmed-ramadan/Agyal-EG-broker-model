import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { Auth, BROKER_STAFF, CurrentUser, type AuthUser, type Role } from '../../common/auth';
import { hashPassword } from '../../common/crypto.util';
import { DbService } from '../../common/db.service';
import { DEFAULT_TENANT_CONFIG } from '../../common/tenant-config';
import { parseBody } from '../../common/validation';
import { isValidIsin } from '../../domain/isin';
import { EGYPT_MOBILE } from '../identity/identity.controller';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour like #0b4f6c');

const TenantSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/, '3-40 lowercase letters, digits or hyphens'),
  legalNameEn: z.string().min(2),
  legalNameAr: z.string().min(2),
  fraLicenseNo: z.string().optional(),
  customDomain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Domain like invest.brokerx.com.eg').optional(),
  branding: z.object({
    displayName: z.object({ en: z.string(), ar: z.string() }),
    logoUrl: z.string(),
    colors: z.object({ primary: hex, primaryContrast: hex, accent: hex }),
    supportEmail: z.string().email(),
    supportPhone: z.string().optional(),
    legalDocuments: z.object({
      termsUrl: z.string(),
      riskDisclosureUrl: z.string(),
      privacyUrl: z.string(),
    }),
  }),
});

const StaffSchema = z.object({
  email: z.string().email(),
  /** Receives the sign-in codes */
  mobile: z.string().regex(EGYPT_MOBILE, 'Egyptian mobile number'),
  password: z.string().min(10),
  roles: z.array(z.enum(BROKER_STAFF as [Role, ...Role[]])).min(1),
});

const InstrumentSchema = z
  .object({
    isin: z.string().refine(isValidIsin, 'Invalid ISIN (check digit)'),
    type: z.enum(['TREASURY_BILL', 'TREASURY_BOND', 'CORPORATE_BOND', 'SUKUK']),
    issuer: z.string().min(2),
    nameEn: z.string().min(3),
    nameAr: z.string().min(3),
    couponRate: z.string().regex(/^0?\.\d{1,6}$/, 'Annual rate as a fraction, e.g. 0.22').optional(),
    couponFreq: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(12)]).optional(),
    issueDate: z.string().date().optional(),
    maturityDate: z.string().date(),
    depository: z.enum(['MCDR', 'CBE', 'BANK_INTERNAL']),
    minQty: z.string().regex(/^\d+$/),
    qtyIncrement: z.string().regex(/^\d+$/),
  })
  .refine((i) => (i.type === 'TREASURY_BILL') === (i.couponRate === undefined && i.couponFreq === undefined), {
    message: 'T-bills have no coupon; other instruments need couponRate and couponFreq',
  });

const BankRelationSchema = z.object({
  bankCode: z.string(),
  brokerAccountAtBank: z.string().min(1),
});

/** Agyal operators only: set up brokers, their staff and bank relationships. */
@Controller('admin')
@Auth('PLATFORM_ADMIN')
export class AdminController {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  @Get('tenants')
  tenants() {
    return this.db.tenant.findMany({ orderBy: { createdAt: 'asc' } });
  }

  @Post('tenants')
  async createTenant(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = parseBody(TenantSchema, body);
    const tenant = await this.db.tenant.create({
      data: {
        slug: input.slug,
        legalNameEn: input.legalNameEn,
        legalNameAr: input.legalNameAr,
        fraLicenseNo: input.fraLicenseNo,
        customDomain: input.customDomain,
        branding: { tenantSlug: input.slug, ...input.branding },
        config: DEFAULT_TENANT_CONFIG as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId: user.sub,
      action: 'TENANT_CREATED',
      entity: 'Tenant',
      entityId: tenant.id,
    });
    return tenant;
  }

  @Get('tenants/:slug/staff')
  async staff(@Param('slug') slug: string) {
    const tenant = await this.tenantBySlug(slug);
    const users = await this.db.user.findMany({
      where: { tenantId: tenant.id, NOT: { roles: { has: 'CLIENT' } } },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      mobile: u.mobile,
      roles: u.roles,
      mobileVerified: Boolean(u.mobileVerifiedAt),
      createdAt: u.createdAt,
    }));
  }

  @Post('tenants/:slug/staff')
  async createStaff(@CurrentUser() actor: AuthUser, @Param('slug') slug: string, @Body() body: unknown) {
    const tenant = await this.tenantBySlug(slug);
    const input = parseBody(StaffSchema, body);
    const email = input.email.toLowerCase();
    if (await this.db.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email } } })) {
      throw new ConflictException('A user with this email already exists for this broker');
    }
    const user = await this.db.user.create({
      data: {
        tenantId: tenant.id,
        email,
        mobile: input.mobile,
        passwordHash: hashPassword(input.password),
        roles: input.roles,
      },
    });
    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId: actor.sub,
      action: 'STAFF_CREATED',
      entity: 'User',
      entityId: user.id,
      data: { email, roles: input.roles },
    });
    return { id: user.id, email: user.email, roles: user.roles };
  }

  @Get('tenants/:slug/banks')
  async bankLinks(@Param('slug') slug: string) {
    const tenant = await this.tenantBySlug(slug);
    const links = await this.db.forTenant(tenant.id, (tx) =>
      tx.brokerBankRelationship.findMany({ include: { bank: true } }),
    );
    return links.map((l) => ({
      bankCode: l.bank.code,
      bankName: l.bank.nameEn,
      connectionMode: l.bank.connectionMode,
      brokerAccountAtBank: l.brokerAccountAtBank,
      active: l.active,
    }));
  }

  @Post('tenants/:slug/banks')
  async linkBank(@Param('slug') slug: string, @Body() body: unknown) {
    const tenant = await this.tenantBySlug(slug);
    const input = parseBody(BankRelationSchema, body);
    const bank = await this.db.bank.findUnique({ where: { code: input.bankCode } });
    if (!bank) throw new NotFoundException('Unknown bank');
    return this.db.forTenant(tenant.id, (tx) =>
      tx.brokerBankRelationship.upsert({
        where: { tenantId_bankId: { tenantId: tenant.id, bankId: bank.id } },
        create: { tenantId: tenant.id, bankId: bank.id, brokerAccountAtBank: input.brokerAccountAtBank },
        update: { brokerAccountAtBank: input.brokerAccountAtBank, active: true },
      }),
    );
  }

  @Get('banks')
  banks() {
    return this.db.bank.findMany({ orderBy: { code: 'asc' } });
  }

  @Get('instruments')
  instruments() {
    return this.db.instrument.findMany({ orderBy: [{ maturityDate: 'asc' }] });
  }

  @Post('instruments')
  async createInstrument(@CurrentUser() actor: AuthUser, @Body() body: unknown) {
    const input = parseBody(InstrumentSchema, body);
    const maturity = new Date(`${input.maturityDate}T00:00:00Z`);
    if (maturity <= new Date()) throw new BadRequestException('Maturity must be in the future');
    if (await this.db.instrument.findUnique({ where: { isin: input.isin } })) {
      throw new ConflictException('An instrument with this ISIN already exists');
    }
    const instrument = await this.db.instrument.create({
      data: {
        ...input,
        issueDate: input.issueDate ? new Date(`${input.issueDate}T00:00:00Z`) : null,
        maturityDate: maturity,
      },
    });
    await this.audit.record(this.db, {
      tenantId: null,
      actorId: actor.sub,
      action: 'INSTRUMENT_CREATED',
      entity: 'Instrument',
      entityId: instrument.id,
      data: { isin: input.isin },
    });
    return instrument;
  }

  /** FIX bridge health: outbox backlog, inbox errors, last message per session. */
  @Get('fix/health')
  async fixHealth() {
    const outbox = await this.db.fixOutbox.groupBy({ by: ['status'], _count: { _all: true } });
    const oldestPending = await this.db.fixOutbox.findFirst({ where: { status: 'PENDING' }, orderBy: { id: 'asc' } });
    const inboxPending = await this.db.fixInbox.count({ where: { processedAt: null } });
    const inboxErrors = await this.db.fixInbox.findMany({
      where: { error: { not: null } },
      orderBy: { id: 'desc' },
      take: 10,
    });
    const sessions = await this.db.fixMessage.groupBy({
      by: ['sessionId'],
      _max: { createdAt: true },
      _count: { _all: true },
    });
    return {
      outbox: Object.fromEntries(outbox.map((o) => [o.status, o._count._all])),
      oldestPendingSince: oldestPending?.createdAt ?? null,
      inboxPending,
      inboxErrors: inboxErrors.map((e) => ({ id: e.id.toString(), msgType: e.msgType, error: e.error, receivedAt: e.receivedAt })),
      sessions: sessions.map((s) => ({ sessionId: s.sessionId, messages: s._count._all, lastMessageAt: s._max.createdAt })),
    };
  }

  @Get('fix/messages')
  fixMessages() {
    return this.db.fixMessage
      .findMany({ orderBy: { id: 'desc' }, take: 100 })
      .then((rows) => rows.map((r) => ({ ...r, id: r.id.toString() })));
  }

  private async tenantBySlug(slug: string) {
    const tenant = await this.db.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Unknown tenant');
    return tenant;
  }
}
