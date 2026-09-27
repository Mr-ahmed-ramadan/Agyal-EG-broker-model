import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Tenant } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import { signToken, type AuthUser, type Role } from '../../common/auth';
import { hashPassword, verifyPassword } from '../../common/crypto.util';
import { DbService } from '../../common/db.service';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function depositReference(): string {
  const bytes = randomBytes(8);
  return 'AG' + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async registerClient(
    tenant: Tenant,
    input: { email: string; mobile: string; password: string; fullNameEn: string },
  ) {
    const email = input.email.toLowerCase();
    const existing = await this.db.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (existing) throw new ConflictException('An account with this email already exists');

    // User and client are created in one transaction so a failure leaves no orphan login.
    const { user, client } = await this.db.forTenant(tenant.id, async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          mobile: input.mobile,
          passwordHash: hashPassword(input.password),
          roles: ['CLIENT'],
        },
      });
      const c = await tx.client.create({
        data: {
          tenantId: tenant.id,
          userId: u.id,
          fullNameEn: input.fullNameEn,
          depositReference: depositReference(),
        },
      });
      await tx.onboardingApplication.create({
        data: { tenantId: tenant.id, clientId: c.id, completed: [] },
      });
      await tx.investorCode.create({ data: { tenantId: tenant.id, clientId: c.id } });
      await this.audit.record(tx, {
        tenantId: tenant.id,
        actorId: u.id,
        action: 'CLIENT_REGISTERED',
        entity: 'Client',
        entityId: c.id,
      });
      return { user: u, client: c };
    });
    return this.issue({ sub: user.id, tenantId: tenant.id, roles: ['CLIENT'], clientId: client.id });
  }

  /** Tenant users log in on their broker's host; platform admins with no tenant. */
  async login(tenant: Tenant | undefined, email: string, password: string) {
    const user = await this.db.user.findFirst({
      where: { tenantId: tenant?.id ?? null, email: email.toLowerCase() },
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const roles = user.roles as Role[];
    let clientId: string | undefined;
    if (tenant && roles.includes('CLIENT')) {
      const client = await this.db.forTenant(tenant.id, (tx) =>
        tx.client.findUnique({ where: { userId: user.id } }),
      );
      clientId = client?.id;
    }
    return this.issue({ sub: user.id, tenantId: user.tenantId, roles, clientId });
  }

  private issue(user: AuthUser) {
    return { accessToken: signToken(user), user };
  }
}
