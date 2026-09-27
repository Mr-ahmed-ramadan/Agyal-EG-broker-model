import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { Auth, BROKER_STAFF, CurrentUser, type AuthUser, type Role } from '../../common/auth';
import { hashPassword } from '../../common/crypto.util';
import { DbService } from '../../common/db.service';
import { DEFAULT_TENANT_CONFIG } from '../../common/tenant-config';
import { parseBody } from '../../common/validation';
import { EGYPT_MOBILE } from '../identity/identity.controller';

const TenantSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  legalNameEn: z.string().min(2),
  legalNameAr: z.string().min(2),
  fraLicenseNo: z.string().optional(),
  customDomain: z.string().optional(),
  branding: z.object({
    displayName: z.object({ en: z.string(), ar: z.string() }),
    logoUrl: z.string(),
    colors: z.object({ primary: z.string(), primaryContrast: z.string(), accent: z.string() }),
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

  @Post('tenants/:slug/staff')
  async createStaff(@Param('slug') slug: string, @Body() body: unknown) {
    const tenant = await this.tenantBySlug(slug);
    const input = parseBody(StaffSchema, body);
    const user = await this.db.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email.toLowerCase(),
        mobile: input.mobile,
        passwordHash: hashPassword(input.password),
        roles: input.roles,
      },
    });
    return { id: user.id, email: user.email, roles: user.roles };
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
