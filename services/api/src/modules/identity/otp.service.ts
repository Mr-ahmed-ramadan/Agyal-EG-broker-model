import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { DbService } from '../../common/db.service';
import {
  canIssue,
  checkCode,
  generateCode,
  hashCode,
  OTP_TTL_MS,
  shouldEchoCode,
  type OtpPurpose,
} from '../../domain/otp';
import { OTP_DELIVERY, type OtpDelivery } from './otp-delivery';

function otpSecret(): string {
  const s = process.env.OTP_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('OTP_SECRET must be set');
  return 'dev-only-otp-secret';
}


export interface IssuedChallenge {
  challengeId: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  sentTo: string;
  /** Shown on-screen for demo accounts (DEMO_LOGINS) or in dev (OTP_DEV_ECHO); never for real users. */
  devCode?: string;
}

@Injectable()
export class OtpService {
  private readonly log = new Logger(OtpService.name);

  constructor(
    private readonly db: DbService,
    @Inject(OTP_DELIVERY) private readonly delivery: OtpDelivery,
  ) {}

  /**
   * Sends a code. For STEP_UP, `payload` describes the action the code will
   * authorise; it is stored with the challenge and returned on verification.
   */
  async issue(
    user: User,
    purpose: OtpPurpose,
    senderName: string,
    payload?: Prisma.InputJsonValue,
  ): Promise<IssuedChallenge> {
    // Verifying a mobile obviously needs one. Otherwise all that is required is
    // somewhere to send the code: delivery already falls back to email when
    // there is no mobile, which is how demo accounts (deliberately without one)
    // sign in.
    if (purpose === 'VERIFY_MOBILE' && !user.mobile) {
      throw new UnauthorizedException('No mobile number on this account');
    }
    if (!user.mobile && !user.email) throw new UnauthorizedException('No way to send a code to this account');
    const recent = await this.db.otpChallenge.findMany({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
      select: { createdAt: true, purpose: true, payload: true },
    });
    const kind = JSON.stringify(payload ?? null);
    const sameKind = recent.filter((r) => r.purpose === purpose && JSON.stringify(r.payload ?? null) === kind);
    const allowed = canIssue(
      recent.map((r) => r.createdAt),
      sameKind.map((r) => r.createdAt),
    );
    if (!allowed.ok) {
      throw new HttpException(
        { message: 'Please wait before requesting another code', retryAfterSeconds: Math.ceil(allowed.retryAfterMs / 1000) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateCode();
    const challenge = await this.db.$transaction(async (tx) => {
      // Only the newest code for a purpose is valid.
      await tx.otpChallenge.updateMany({
        where: { userId: user.id, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      const created = await tx.otpChallenge.create({
        data: {
          userId: user.id,
          purpose,
          payload,
          codeHash: 'pending',
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      });
      return tx.otpChallenge.update({
        where: { id: created.id },
        data: { codeHash: hashCode(otpSecret(), created.id, code) },
      });
    });

    let sentTo: string;
    try {
      sentTo = await this.delivery.deliver({ mobile: user.mobile, email: user.email }, code, senderName, purpose);
    } catch (err) {
      this.log.error(`Could not deliver ${purpose} code to user ${user.id}: ${(err as Error).message}`);
      throw new ServiceUnavailableException('We could not send your code right now. Please try again in a minute.');
    }
    return {
      challengeId: challenge.id,
      purpose,
      expiresAt: challenge.expiresAt,
      sentTo,
      ...(shouldEchoCode(user.email) ? { devCode: code } : {}),
    };
  }

  /**
   * Verifies a code for one of the allowed purposes; returns the user (and a
   * step-up payload) on success. Every attempt is counted.
   */
  async verify(
    challengeId: string,
    code: string,
    allowed: OtpPurpose[],
  ): Promise<{ user: User; purpose: OtpPurpose; payload: Prisma.JsonValue | null }> {
    const challenge = await this.db.otpChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
    // A code for one purpose (e.g. a withdrawal) can never be used for another (e.g. sign-in).
    if (!challenge || !allowed.includes(challenge.purpose as OtpPurpose)) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    const result = checkCode(otpSecret(), challenge, code);
    if (result === 'OK') {
      const claimed = await this.db.otpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      });
      if (claimed.count === 1) {
        return { user: challenge.user, purpose: challenge.purpose as OtpPurpose, payload: challenge.payload };
      }
    } else if (result === 'INVALID') {
      await this.db.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    }
    if (result === 'TOO_MANY_ATTEMPTS') {
      throw new HttpException('Too many attempts; request a new code', HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new UnauthorizedException('Invalid or expired code');
  }

  /** A new code for the same user, purpose and pending action as an earlier challenge. */
  async resend(challengeId: string, senderName: (user: User) => Promise<string>) {
    const challenge = await this.db.otpChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
    if (!challenge) throw new UnauthorizedException('Unknown challenge');
    return this.issue(
      challenge.user,
      challenge.purpose as OtpPurpose,
      await senderName(challenge.user),
      (challenge.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    );
  }
}
