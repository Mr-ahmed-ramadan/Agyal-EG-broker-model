import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { Auth, BROKER_STAFF, CurrentUser, type AuthUser, type Role } from '../../common/auth';
import { hashPassword } from '../../common/crypto.util';
import { DbService } from '../../common/db.service';
import { DEFAULT_TENANT_CONFIG } from '../../common/tenant-config';
import { parseBody } from '../../common/validation';
import { isValidIsin } from '../../domain/isin';
import { contrastText, logoProblem, slugify } from '../../domain/showcase';
import { prospectLinks } from '../showcase/showcase.service';
import { EGYPT_MOBILE } from '../identity/identity.controller';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour like #0b4f6c');

const BrandingSchema = z.object({
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
});

const DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const STATUSES = ['ONBOARDING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED'] as const;

/**
 * One create for both kinds. The slug, the contrasting text colour and the
 * first login are all optional because typing them by hand was the worst part
 * of setting a broker up; the prospect demo path has derived them for a while
 * and this borrows the same helpers.
 */
const TenantSchema = z.object({
  kind: z.enum(['BROKER', 'PROSPECT_DEMO']).default('BROKER'),
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/, '3-40 lowercase letters, digits or hyphens').optional(),
  legalNameEn: z.string().min(2),
  legalNameAr: z.string().min(2),
  fraLicenseNo: z.string().optional(),
  customDomain: z.string().regex(DOMAIN, 'Domain like invest.brokerx.com.eg').optional(),
  branding: BrandingSchema,
  /** Copy this broker's active partner banks, so quoting works immediately. */
  copyBanksFrom: z.string().optional(),
  /** The first staff member. The temporary password is returned once. */
  login: z
    .object({
      email: z.string().email(),
      mobile: z.string().regex(EGYPT_MOBILE, 'Egyptian mobile number'),
      roles: z.array(z.enum(BROKER_STAFF as [Role, ...Role[]])).min(1).optional(),
    })
    .optional(),
});

/** Deep-partial: changing one colour must not require re-sending the others. */
const BrandingPatchSchema = z
  .object({
    displayName: z.object({ en: z.string(), ar: z.string() }).partial(),
    logoUrl: z.string(),
    colors: z.object({ primary: hex, primaryContrast: hex, accent: hex }).partial(),
    supportEmail: z.string().email(),
    supportPhone: z.string(),
    legalDocuments: z
      .object({ termsUrl: z.string(), riskDisclosureUrl: z.string(), privacyUrl: z.string() })
      .partial(),
  })
  .partial();

const TenantPatchSchema = z
  .object({
    legalNameEn: z.string().min(2),
    legalNameAr: z.string().min(2),
    fraLicenseNo: z.string().nullable(),
    customDomain: z.string().regex(DOMAIN, 'Domain like invest.brokerx.com.eg').nullable(),
    status: z.enum(STATUSES),
    branding: BrandingPatchSchema,
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, 'Nothing to change');

const TenantQuerySchema = z.object({
  kind: z.enum(['BROKER', 'PROSPECT_DEMO']).optional(),
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
});

const StaffSchema = z.object({
  email: z.string().email(),
  /** Receives the sign-in codes */
  mobile: z.string().regex(EGYPT_MOBILE, 'Egyptian mobile number'),
  /** Omit to have one generated and returned once. */
  password: z.string().min(10).optional(),
  roles: z.array(z.enum(BROKER_STAFF as [Role, ...Role[]])).min(1),
});

const StaffPatchSchema = z
  .object({
    mobile: z.string().regex(EGYPT_MOBILE, 'Egyptian mobile number'),
    roles: z.array(z.enum(BROKER_STAFF as [Role, ...Role[]])).min(1),
    /** Issues a new temporary password and returns it once. */
    resetPassword: z.literal(true),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, 'Nothing to change');

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

  /**
   * Every tenant, brokers and demos alike, because they are the same kind of
   * row and the console shows them in one list. The counts are what tell the
   * caller whether a tenant is empty, which decides whether it can be deleted.
   */
  @Get('tenants')
  async tenants(@Query() query: unknown) {
    const q = parseBody(TenantQuerySchema, query ?? {});
    const tenants = await this.db.tenant.findMany({
      where: {
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.q
          ? {
              OR: [
                { slug: { contains: q.q, mode: 'insensitive' as const } },
                { legalNameEn: { contains: q.q, mode: 'insensitive' as const } },
                { legalNameAr: { contains: q.q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      tenants.map(async (t) => ({ ...t, counts: await this.counts(t.id), links: prospectLinks(t.slug) })),
    );
  }

  @Post('tenants')
  async createTenant(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = parseBody(TenantSchema, body);
    if (input.branding.logoUrl) {
      const problem = logoProblem(input.branding.logoUrl);
      if (problem) throw new BadRequestException(problem);
    }

    // A slug nobody has to invent: derived from the name, then made unique.
    let slug = input.slug ?? slugify(input.legalNameEn);
    if (!input.slug) {
      const base = slug;
      for (let n = 2; await this.db.tenant.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
    } else if (await this.db.tenant.findUnique({ where: { slug } })) {
      throw new ConflictException(`A tenant with the slug "${slug}" already exists`);
    }

    const branding = {
      ...input.branding,
      colors: { ...input.branding.colors, primaryContrast: contrastText(input.branding.colors.primary) },
    };

    const tenant = await this.db.asSystem((tx) => tx.tenant.create({
      data: {
        slug,
        kind: input.kind,
        legalNameEn: input.legalNameEn,
        legalNameAr: input.legalNameAr,
        fraLicenseNo: input.fraLicenseNo,
        customDomain: input.customDomain,
        branding: { tenantSlug: slug, ...branding },
        config: DEFAULT_TENANT_CONFIG as unknown as Prisma.InputJsonValue,
      },
    }));

    // Partner banks copied from an existing broker, so quoting works at once.
    if (input.copyBanksFrom) {
      const from = await this.db.tenant.findUnique({ where: { slug: input.copyBanksFrom } });
      if (!from) throw new NotFoundException(`No tenant "${input.copyBanksFrom}" to copy banks from`);
      const rels = await this.db.forTenant(from.id, (tx) => tx.brokerBankRelationship.findMany({ where: { active: true } }));
      await this.db.forTenant(tenant.id, async (tx) => {
        for (const rel of rels) {
          await tx.brokerBankRelationship.create({
            data: { tenantId: tenant.id, bankId: rel.bankId, brokerAccountAtBank: `${slug.toUpperCase()}-${rel.brokerAccountAtBank}`.slice(0, 64) },
          });
        }
      });
    }

    let credentials: { email: string; temporaryPassword: string } | undefined;
    if (input.login) {
      const temporaryPassword = randomBytes(9).toString('base64url');
      await this.db.asSystem((tx) => tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.login!.email.toLowerCase(),
          mobile: input.login!.mobile,
          passwordHash: hashPassword(temporaryPassword),
          roles: input.login!.roles ?? [...BROKER_STAFF],
        },
      }));
      credentials = { email: input.login.email.toLowerCase(), temporaryPassword };
    }

    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId: user.sub,
      action: 'TENANT_CREATED',
      entity: 'Tenant',
      entityId: tenant.id,
      data: { kind: input.kind, slug, login: input.login?.email ?? null },
    });
    return { ...tenant, counts: await this.counts(tenant.id), links: prospectLinks(tenant.slug), credentials };
  }

  /** Partial: only the keys sent are changed. */
  @Patch('tenants/:slug')
  async updateTenant(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body() body: unknown) {
    const input = parseBody(TenantPatchSchema, body);
    const tenant = await this.tenantBySlug(slug);

    if (input.customDomain) {
      const clash = await this.db.tenant.findUnique({ where: { customDomain: input.customDomain } });
      if (clash && clash.id !== tenant.id) throw new ConflictException('Another broker already uses that domain');
    }
    if (input.branding?.logoUrl) {
      const problem = logoProblem(input.branding.logoUrl);
      if (problem) throw new BadRequestException(problem);
    }

    // Branding merges key by key, so changing one colour does not drop the logo.
    const current = tenant.branding as Record<string, unknown>;
    const branding = input.branding
      ? {
          ...current,
          ...input.branding,
          ...(input.branding.colors
            ? {
                colors: {
                  ...(current.colors as Record<string, unknown>),
                  ...input.branding.colors,
                  ...(input.branding.colors.primary ? { primaryContrast: contrastText(input.branding.colors.primary) } : {}),
                },
              }
            : {}),
          ...(input.branding.displayName
            ? { displayName: { ...(current.displayName as Record<string, unknown>), ...input.branding.displayName } }
            : {}),
          ...(input.branding.legalDocuments
            ? { legalDocuments: { ...(current.legalDocuments as Record<string, unknown>), ...input.branding.legalDocuments } }
            : {}),
        }
      : undefined;

    const updated = await this.db.asSystem((tx) => tx.tenant.update({
      where: { id: tenant.id },
      data: {
        ...(input.legalNameEn !== undefined ? { legalNameEn: input.legalNameEn } : {}),
        ...(input.legalNameAr !== undefined ? { legalNameAr: input.legalNameAr } : {}),
        ...(input.fraLicenseNo !== undefined ? { fraLicenseNo: input.fraLicenseNo } : {}),
        ...(input.customDomain !== undefined ? { customDomain: input.customDomain } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(branding ? { branding: branding as Prisma.InputJsonValue } : {}),
      },
    }));

    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId: user.sub,
      action: 'TENANT_UPDATED',
      entity: 'Tenant',
      entityId: tenant.id,
      data: { changed: Object.keys(input) },
    });
    return { ...updated, counts: await this.counts(tenant.id), links: prospectLinks(updated.slug) };
  }

  /**
   * Only an empty prospect demo is ever really deleted. A broker that has
   * traded carries a ledger and an audit trail that must outlive the console,
   * so it is offboarded instead.
   */
  @Delete('tenants/:slug')
  async deleteTenant(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const tenant = await this.tenantBySlug(slug);
    if (tenant.kind !== 'PROSPECT_DEMO') {
      throw new ConflictException('Only a prospect demo can be deleted. Set this broker to OFFBOARDED instead.');
    }
    const counts = await this.counts(tenant.id);
    if (counts.clients > 0 || counts.orders > 0) {
      throw new ConflictException(
        `This demo has ${counts.clients} client(s) and ${counts.orders} order(s), so it keeps a ledger. Set it to OFFBOARDED instead.`,
      );
    }

    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId: user.sub,
      action: 'TENANT_DELETED',
      entity: 'Tenant',
      entityId: tenant.id,
      data: { slug: tenant.slug, kind: tenant.kind },
    });
    // Audited before the row goes, so the trail survives the tenant. Order
    // matters: OtpChallenge and BrokerBankRelationship hold the only foreign
    // keys into User and Tenant, so they go first.
    await this.db.asSystem(async (tx) => {
      const users = await tx.user.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
      await tx.otpChallenge.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
      await tx.brokerBankRelationship.deleteMany({ where: { tenantId: tenant.id } });
      await tx.user.deleteMany({ where: { tenantId: tenant.id } });
      await tx.tenant.delete({ where: { id: tenant.id } });
    });
    return { deleted: true, slug: tenant.slug };
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
      disabled: u.disabledAt !== null,
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
    // Nobody should have to invent a password for someone else.
    const temporaryPassword = input.password ? undefined : randomBytes(9).toString('base64url');
    const user = await this.db.asSystem((tx) => tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        mobile: input.mobile,
        passwordHash: hashPassword(temporaryPassword ?? input.password!),
        roles: input.roles,
      },
    }));
    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId: actor.sub,
      action: 'STAFF_CREATED',
      entity: 'User',
      entityId: user.id,
      data: { email, roles: input.roles },
    });
    return { id: user.id, email: user.email, roles: user.roles, temporaryPassword };
  }

  /** Roles, mobile, or a new temporary password. Partial. */
  @Patch('tenants/:slug/staff/:id')
  async updateStaff(
    @CurrentUser() actor: AuthUser,
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(StaffPatchSchema, body);
    const { tenant, user } = await this.staffMember(slug, id);
    const temporaryPassword = input.resetPassword ? randomBytes(9).toString('base64url') : undefined;

    const updated = await this.db.asSystem((tx) => tx.user.update({
      where: { id: user.id },
      data: {
        ...(input.roles ? { roles: input.roles } : {}),
        ...(input.mobile ? { mobile: input.mobile, mobileVerifiedAt: null } : {}),
        ...(temporaryPassword ? { passwordHash: hashPassword(temporaryPassword) } : {}),
      },
    }));
    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId: actor.sub,
      action: 'STAFF_UPDATED',
      entity: 'User',
      entityId: user.id,
      data: { changed: Object.keys(input) },
    });
    return { id: updated.id, email: updated.email, roles: updated.roles, mobile: updated.mobile, temporaryPassword };
  }

  /**
   * Access off, row kept: the compliance decisions and withdrawal approvals
   * this person made still have to point at a named user.
   */
  @Post('tenants/:slug/staff/:id/disable')
  disableStaff(@CurrentUser() actor: AuthUser, @Param('slug') slug: string, @Param('id') id: string) {
    return this.setStaffDisabled(actor, slug, id, new Date());
  }

  @Post('tenants/:slug/staff/:id/enable')
  enableStaff(@CurrentUser() actor: AuthUser, @Param('slug') slug: string, @Param('id') id: string) {
    return this.setStaffDisabled(actor, slug, id, null);
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
    const instrument = await this.db.asSystem((tx) => tx.instrument.create({
      data: {
        ...input,
        issueDate: input.issueDate ? new Date(`${input.issueDate}T00:00:00Z`) : null,
        maturityDate: maturity,
      },
    }));
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

  /**
   * What is under a tenant: decides whether it can be deleted, and is shown in
   * the list. Counted as system, because Client and Order are behind row-level
   * security and an admin request carries no tenant context — through the
   * ordinary client every count would come back zero, and an inhabited broker
   * would look empty enough to delete.
   */
  private counts(tenantId: string) {
    return this.db.asSystem(async (tx) => {
      const [users, clients, orders] = await Promise.all([
        tx.user.count({ where: { tenantId, NOT: { roles: { has: 'CLIENT' } } } }),
        tx.client.count({ where: { tenantId } }),
        tx.order.count({ where: { tenantId } }),
      ]);
      return { users, clients, orders };
    });
  }

  private async staffMember(slug: string, id: string) {
    const tenant = await this.tenantBySlug(slug);
    const user = await this.db.user.findUnique({ where: { id } });
    if (!user || user.tenantId !== tenant.id || user.roles.includes('CLIENT')) {
      throw new NotFoundException('Unknown staff member for this broker');
    }
    return { tenant, user };
  }

  private async setStaffDisabled(actor: AuthUser, slug: string, id: string, disabledAt: Date | null) {
    const { tenant, user } = await this.staffMember(slug, id);
    await this.db.asSystem((tx) => tx.user.update({ where: { id: user.id }, data: { disabledAt } }));
    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId: actor.sub,
      action: disabledAt ? 'STAFF_DISABLED' : 'STAFF_ENABLED',
      entity: 'User',
      entityId: user.id,
      data: { email: user.email },
    });
    return { id: user.id, email: user.email, disabled: disabledAt !== null };
  }
}
