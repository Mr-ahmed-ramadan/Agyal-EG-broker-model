import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Tenant, User } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import { signToken, type AuthUser, type Role } from '../../common/auth';
import { hashPassword, verifyPassword } from '../../common/crypto.util';
import { DbService } from '../../common/db.service';
import { OtpService } from './otp.service';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function depositReference(): string {
  const bytes = randomBytes(8);
  return 'AG' + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}

/** A password check that costs the same whether or not the user exists. */
const DUMMY_HASH = hashPassword('timing-equaliser');

/**
 * Two-step sign-in (ADR 0010): password, then a one-time code sent by SMS.
 * Registration sends a code too, which proves the client owns the mobile.
 * A token is only issued after a code is verified.
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly otp: OtpService,
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
    const user = await this.db.forTenant(tenant.id, async (tx) => {
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
      return u;
    });
    return this.otp.issue(user, 'VERIFY_MOBILE', this.senderName(tenant));
  }

  /** Step 1: password. Tenant users sign in on their broker's host; platform admins with no tenant. */
  async login(tenant: Tenant | undefined, email: string, password: string) {
    const user = await this.db.user.findFirst({
      where: { tenantId: tenant?.id ?? null, email: email.toLowerCase() },
    });
    const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');
    // Checked after the password, so a disabled account is indistinguishable
    // from a wrong one on a public endpoint and the timing stays even.
    if (user.disabledAt) throw new UnauthorizedException('Invalid email or password');
    return this.otp.issue(user, user.mobileVerifiedAt ? 'LOGIN' : 'VERIFY_MOBILE', this.senderName(tenant));
  }

  /** Step 2: the one-time code. Returns the access token. */
  async verifyOtp(tenant: Tenant | undefined, challengeId: string, code: string) {
    const { user, purpose } = await this.otp.verify(challengeId, code, ['LOGIN', 'VERIFY_MOBILE']);
    // A code issued before the access was taken away must not still spend.
    if (user.disabledAt) throw new UnauthorizedException('Invalid email or password');
    if ((user.tenantId ?? null) !== (tenant?.id ?? null)) {
      throw new ForbiddenException('This code belongs to a different broker');
    }
    if (!user.mobileVerifiedAt) {
      await this.db.user.update({ where: { id: user.id }, data: { mobileVerifiedAt: new Date() } });
    }
    await this.db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        action: purpose === 'LOGIN' ? 'SIGNED_IN' : 'MOBILE_VERIFIED',
        entity: 'User',
        entityId: user.id,
      },
    });
    return this.issueToken(tenant, user);
  }

  resend(tenant: Tenant | undefined, challengeId: string) {
    return this.otp.resend(challengeId, async () => this.senderName(tenant));
  }

  private async issueToken(tenant: Tenant | undefined, user: User) {
    const roles = user.roles as Role[];
    let clientId: string | undefined;
    if (tenant && roles.includes('CLIENT')) {
      const client = await this.db.forTenant(tenant.id, (tx) =>
        tx.client.findUnique({ where: { userId: user.id } }),
      );
      clientId = client?.id;
    }
    const authUser: AuthUser = { sub: user.id, tenantId: user.tenantId, roles, clientId };
    return { accessToken: signToken(authUser), user: authUser };
  }

  senderName(tenant: Tenant | undefined): string {
    const branding = tenant?.branding as { displayName?: { en?: string } } | undefined;
    return branding?.displayName?.en ?? 'Agyal';
  }
}
