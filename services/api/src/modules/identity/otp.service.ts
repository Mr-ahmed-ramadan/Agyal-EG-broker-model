import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { DbService } from '../../common/db.service';
import {
  canIssue,
  checkCode,
  generateCode,
  hashCode,
  maskMobile,
  OTP_TTL_MS,
  type OtpPurpose,
} from '../../domain/otp';
import { SMS_PROVIDER, type SmsProvider } from './sms.provider';

function otpSecret(): string {
  const s = process.env.OTP_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('OTP_SECRET must be set');
  return 'dev-only-otp-secret';
}

/** Only outside production, and only when explicitly enabled, is the code returned to the caller. */
function devEcho(): boolean {
  return process.env.OTP_DEV_ECHO === 'true' && process.env.NODE_ENV !== 'production';
}

export interface IssuedChallenge {
  challengeId: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  sentTo: string;
  /** Development only (OTP_DEV_ECHO=true) */
  devCode?: string;
}

@Injectable()
export class OtpService {
  constructor(
    private readonly db: DbService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async issue(user: User, purpose: OtpPurpose, senderName: string): Promise<IssuedChallenge> {
    if (!user.mobile) throw new UnauthorizedException('No mobile number on this account');
    const recent = await this.db.otpChallenge.findMany({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
      select: { createdAt: true },
    });
    const allowed = canIssue(recent.map((r) => r.createdAt));
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
        data: { userId: user.id, purpose, codeHash: 'pending', expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      });
      return tx.otpChallenge.update({
        where: { id: created.id },
        data: { codeHash: hashCode(otpSecret(), created.id, code) },
      });
    });

    await this.sms.send(user.mobile, `${code} is your ${senderName} verification code. Do not share it.`, senderName);
    return {
      challengeId: challenge.id,
      purpose,
      expiresAt: challenge.expiresAt,
      sentTo: maskMobile(user.mobile),
      ...(devEcho() ? { devCode: code } : {}),
    };
  }

  /** Verifies a code; returns the user on success. Every attempt is counted. */
  async verify(challengeId: string, code: string): Promise<{ user: User; purpose: OtpPurpose }> {
    const challenge = await this.db.otpChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
    if (!challenge) throw new UnauthorizedException('Invalid or expired code');
    const result = checkCode(otpSecret(), challenge, code);
    if (result === 'OK') {
      const claimed = await this.db.otpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      });
      if (claimed.count === 1) return { user: challenge.user, purpose: challenge.purpose as OtpPurpose };
    } else if (result === 'INVALID') {
      await this.db.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    }
    if (result === 'TOO_MANY_ATTEMPTS') {
      throw new HttpException('Too many attempts; request a new code', HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new UnauthorizedException('Invalid or expired code');
  }

  /** A new code for the same user and purpose as an earlier challenge. */
  async resend(challengeId: string, senderName: (user: User) => Promise<string>) {
    const challenge = await this.db.otpChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
    if (!challenge) throw new UnauthorizedException('Unknown challenge');
    return this.issue(challenge.user, challenge.purpose as OtpPurpose, await senderName(challenge.user));
  }
}
