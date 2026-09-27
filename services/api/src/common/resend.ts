/** Minimal Resend client (https://resend.com/docs/api-reference/emails/send-email). */
export interface ResendEmail {
  from: string;
  to: string[];
  subject: string;
  text: string;
  /** Optional HTML version; mail clients show it instead of the text. */
  html?: string;
  replyTo?: string;
}

export async function sendResendEmail(apiKey: string, email: ResendEmail, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend rejected the email (${res.status}): ${await res.text()}`);
}

/** "Display Name <address>" with characters that would break the header removed. */
export function fromHeader(displayName: string, address: string): string {
  return `${displayName.replace(/[<>"\r\n]/g, '')} <${address}>`;
}

/** Escapes text for use inside HTML email bodies. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
