import { Logger } from '@nestjs/common';

/**
 * Outbound SMS (ADR 0005, ADR 0010). A real Egyptian SMS gateway implements
 * this interface; messages go out under the broker's sender name.
 */
export interface SmsProvider {
  send(to: string, text: string, senderName: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/** Development: logs the message instead of sending it. */
export class LogSmsProvider implements SmsProvider {
  private readonly log = new Logger('SMS');

  async send(to: string, text: string, senderName: string) {
    this.log.log(`[dev] to ${to} from "${senderName}": ${text}`);
  }
}
