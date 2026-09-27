import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma, Tenant } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import { hashPassword } from '../../common/crypto.util';
import { DbService } from '../../common/db.service';
import { fromHeader, sendResendEmail } from '../../common/resend';
import { DEFAULT_TENANT_CONFIG } from '../../common/tenant-config';
import { contrastText, logoProblem, slugify } from '../../domain/showcase';

export interface ContactInput {
  name: string;
  firm: string;
  role?: string;
  email: string;
  mobile?: string;
  message?: string;
}

export interface ProspectInput {
  nameEn: string;
  nameAr: string;
  logoDataUrl?: string;
  primary: string;
  accent: string;
  /** Creates a broker-console login for the prospect (all broker roles) */
  login?: { email: string; mobile: string };
}

/** The tenant whose pricing and bank links new prospect demos copy. */
const TEMPLATE_SLUG = process.env.DEMO_TEMPLATE_SLUG ?? 'demo-broker';

const ALL_BROKER_ROLES = ['BROKER_ADMIN', 'BROKER_COMPLIANCE', 'BROKER_OPS', 'BROKER_FINANCE', 'BROKER_DEALER'];

function appUrl(env: string, fallback: string): string {
  return (process.env[env] ?? fallback).replace(/\/+$/, '');
}

export function prospectLinks(slug: string) {
  return {
    clientApp: `${appUrl('PUBLIC_CLIENT_URL', 'http://localhost:5173')}/?broker=${slug}`,
    brokerConsole: `${appUrl('PUBLIC_BROKER_URL', 'http://localhost:5174')}/?broker=${slug}`,
  };
}

/** Landing-page leads and branded demos for prospect brokers. */
@Injectable()
export class ShowcaseService {
  private readonly log = new Logger(ShowcaseService.name);

  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  /** Saves the lead, then emails it to CONTACT_TO (failure is recorded, not shown to the visitor). */
  async contact(input: ContactInput, ip: string | undefined) {
    const lead = await this.db.lead.create({ data: { ...input, email: input.email.toLowerCase(), ip } });
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const to = process.env.CONTACT_TO;
    if (!apiKey || !from || !to) {
      this.log.log(`New lead ${lead.id} from ${input.firm} (email notification not configured)`);
      return { received: true };
    }
    try {
      await sendResendEmail(apiKey, {
        from: fromHeader('Agyal Egypt', from),
        to: to.split(',').map((s) => s.trim()),
        replyTo: input.email,
        subject: `New broker lead: ${input.firm} (${input.name})`,
        text: [
          `Name: ${input.name}`,
          `Firm: ${input.firm}`,
          `Role: ${input.role ?? '-'}`,
          `Email: ${input.email}`,
          `Mobile: ${input.mobile ?? '-'}`,
          '',
          input.message ?? '(no message)',
        ].join('\n'),
      });
      await this.db.lead.update({ where: { id: lead.id }, data: { emailedAt: new Date() } });
    } catch (err) {
      this.log.error(`Lead ${lead.id} saved but not emailed: ${(err as Error).message}`);
      await this.db.lead.update({ where: { id: lead.id }, data: { error: (err as Error).message.slice(0, 500) } });
    }
    return { received: true };
  }

  leads() {
    return this.db.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  }

  prospects() {
    return this.db.tenant
      .findMany({ where: { kind: 'PROSPECT_DEMO' }, orderBy: { createdAt: 'desc' } })
      .then((ts) => ts.map((t) => this.view(t)));
  }

  /** Creates a branded demo broker from the template and returns shareable links. */
  async createProspect(actorId: string, input: ProspectInput) {
    if (input.logoDataUrl) {
      const problem = logoProblem(input.logoDataUrl);
      if (problem) throw new BadRequestException(problem);
    }
    const template = await this.db.tenant.findUnique({ where: { slug: TEMPLATE_SLUG } });
    if (!template) throw new NotFoundException(`Template broker "${TEMPLATE_SLUG}" not found`);
    if (input.login && (await this.db.user.findFirst({ where: { email: input.login.email.toLowerCase(), tenant: { kind: 'PROSPECT_DEMO' } } }))) {
      throw new ConflictException('That email already has a prospect demo login');
    }

    const base = slugify(input.nameEn);
    let slug = base;
    for (let n = 2; await this.db.tenant.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;

    const tenant = await this.db.asSystem((tx) => tx.tenant.create({
      data: {
        slug,
        kind: 'PROSPECT_DEMO',
        legalNameEn: `${input.nameEn} (demo)`,
        legalNameAr: `${input.nameAr} (تجريبي)`,
        branding: {
          tenantSlug: slug,
          displayName: { en: input.nameEn, ar: input.nameAr },
          logoUrl: input.logoDataUrl ?? '',
          colors: { primary: input.primary, primaryContrast: contrastText(input.primary), accent: input.accent },
          supportEmail: input.login?.email ?? 'support@agyal.net',
          legalDocuments: { termsUrl: '#', riskDisclosureUrl: '#', privacyUrl: '#' },
        },
        config: (template.config ?? DEFAULT_TENANT_CONFIG) as Prisma.InputJsonValue,
      },
    }));

    // Same partner banks as the template, so prices work immediately.
    const templateBanks = await this.db.forTenant(template.id, (tx) => tx.brokerBankRelationship.findMany({ where: { active: true } }));
    await this.db.forTenant(tenant.id, async (tx) => {
      for (const rel of templateBanks) {
        await tx.brokerBankRelationship.create({
          data: { tenantId: tenant.id, bankId: rel.bankId, brokerAccountAtBank: `DEMO-${slug.toUpperCase()}` },
        });
      }
    });

    let credentials: { email: string; temporaryPassword: string } | undefined;
    const login = input.login;
    if (login) {
      const temporaryPassword = randomBytes(9).toString('base64url');
      await this.db.asSystem((tx) => tx.user.create({
        data: {
          tenantId: tenant.id,
          email: login.email.toLowerCase(),
          mobile: login.mobile,
          passwordHash: hashPassword(temporaryPassword),
          roles: ALL_BROKER_ROLES,
        },
      }));
      credentials = { email: login.email.toLowerCase(), temporaryPassword };
    }

    await this.audit.record(this.db, {
      tenantId: tenant.id,
      actorId,
      action: 'PROSPECT_DEMO_CREATED',
      entity: 'Tenant',
      entityId: tenant.id,
      data: { nameEn: input.nameEn, login: input.login?.email ?? null },
    });
    return { ...this.view(tenant), credentials };
  }

  private view(t: Tenant) {
    const b = t.branding as { displayName: { en: string; ar: string }; logoUrl: string; colors: { primary: string } };
    return {
      slug: t.slug,
      nameEn: b.displayName.en,
      nameAr: b.displayName.ar,
      primary: b.colors.primary,
      hasLogo: Boolean(b.logoUrl),
      createdAt: t.createdAt,
      links: prospectLinks(t.slug),
    };
  }
}
