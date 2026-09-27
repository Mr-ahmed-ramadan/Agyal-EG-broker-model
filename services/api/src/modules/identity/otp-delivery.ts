import { Logger } from '@nestjs/common';
import { escapeHtml, fromHeader, sendResendEmail } from '../../common/resend';
import { maskMobile, type OtpPurpose } from '../../domain/otp';

/**
 * Delivers one-time codes (ADR 0010). An Egyptian SMS gateway will implement
 * this; until one is chosen the hosted demo sends codes by email via Resend.
 * Messages go out under the broker's name.
 */
export interface OtpRecipient {
  mobile: string | null;
  email: string;
}

export interface OtpDelivery {
  /** Sends the code; returns a masked description of where it went (shown to the user). */
  deliver(to: OtpRecipient, code: string, senderName: string, purpose: OtpPurpose): Promise<string>;
}

export const OTP_DELIVERY = Symbol('OTP_DELIVERY');

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}•••@${domain}`;
}

const SUBJECT: Record<OtpPurpose, string> = {
  LOGIN: 'sign-in code',
  VERIFY_MOBILE: 'verification code',
  STEP_UP: 'confirmation code',
};

/** Development: logs the message instead of sending it. */
export class LogOtpDelivery implements OtpDelivery {
  private readonly log = new Logger('OTP');

  async deliver(to: OtpRecipient, code: string, senderName: string, purpose: OtpPurpose) {
    this.log.log(`[dev] ${SUBJECT[purpose]} for ${to.mobile ?? to.email} from "${senderName}": ${code}`);
    return to.mobile ? maskMobile(to.mobile) : maskEmail(to.email);
  }
}

/** Hosted demo: emails the code through Resend (https://resend.com). */
export class ResendEmailOtpDelivery implements OtpDelivery {
  constructor(
    private readonly apiKey: string,
    /** Verified sender address, e.g. codes@yourdomain.com */
    private readonly fromAddress: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async deliver(to: OtpRecipient, code: string, senderName: string, purpose: OtpPurpose) {
    // No code in the subject: codes in subject lines are a common spam signal.
    const subject = `${senderName} ${SUBJECT[purpose]}`;
    const footer = `Sent by Agyal on behalf of ${senderName}.`;
    const text =
      `${code} is your ${senderName} ${SUBJECT[purpose]}. It expires in 5 minutes.\n\n` +
      `Do not share this code with anyone, including ${senderName} staff. ` +
      `If you did not ask for it, you can ignore this email.\n\n${footer}`;
    const name = escapeHtml(senderName);
    const html =
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">` +
      `<p style="font-size:16px;margin:0 0 16px">Your ${name} ${SUBJECT[purpose]}:</p>` +
      `<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:0 0 16px">${code}</p>` +
      `<p style="margin:0 0 16px">It expires in 5 minutes. Do not share this code with anyone, including ${name} staff.</p>` +
      `<p style="margin:0 0 24px;color:#6b7280">If you did not ask for it, you can ignore this email.</p>` +
      `<p style="font-size:12px;color:#9ca3af;margin:0">Sent by Agyal on behalf of ${name}.</p></div>`;
    await sendResendEmail(
      this.apiKey,
      { from: fromHeader(senderName, this.fromAddress), to: [to.email], subject, text, html },
      this.fetchImpl,
    );
    return maskEmail(to.email);
  }
}

/** Chooses the delivery from OTP_DELIVERY=log|resend (default log). */
export function otpDeliveryFromEnv(): OtpDelivery {
  if (process.env.OTP_DELIVERY === 'resend') {
    return new ResendEmailOtpDelivery(process.env.RESEND_API_KEY ?? '', process.env.EMAIL_FROM ?? '');
  }
  return new LogOtpDelivery();
}
