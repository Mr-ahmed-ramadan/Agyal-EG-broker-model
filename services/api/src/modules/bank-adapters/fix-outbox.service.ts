import { Injectable, Logger } from '@nestjs/common';
import type { Bank, Prisma } from '@prisma/client';
import type { NewOrderSingleMsg, QuoteRequestMsg } from '@agyal/shared-types';
import type { Tx } from '../../common/db.service';

/**
 * Queues FIX-shaped messages for a bank (ADR 0004). Written in the same
 * transaction as the business change, so a message is sent if and only if
 * the change commits. The FIX gateway delivers FIX-mode banks; PORTAL/FILE
 * banks will be served by their adapters from the same outbox.
 */
@Injectable()
export class FixOutboxService {
  private readonly log = new Logger(FixOutboxService.name);

  async enqueue(tx: Tx, bank: Bank, message: QuoteRequestMsg | NewOrderSingleMsg) {
    if (bank.connectionMode !== 'FIX' || !bank.fixSenderCompId || !bank.fixTargetCompId) {
      this.log.warn(`Bank ${bank.code} is ${bank.connectionMode}; adapter not implemented yet`);
      return;
    }
    await tx.fixOutbox.create({
      data: {
        bankId: bank.id,
        senderCompId: bank.fixSenderCompId,
        targetCompId: bank.fixTargetCompId,
        msgType: message.msgType,
        payload: message as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
