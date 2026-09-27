import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  MsgType,
  type ExecutionReportMsg,
  type QuoteMsg,
} from '@agyal/shared-types';
import { DbService } from '../../common/db.service';
import { OrdersService } from '../orders/orders.service';
import { RfqService } from '../rfq/rfq.service';

type InboxRow = { id: bigint; senderCompId: string; msgType: string; payload: unknown };

/**
 * Consumes messages the FIX gateway wrote to the inbox (ADR 0004) and routes
 * them to their tenant. Each message is handled in one tenant transaction that
 * also marks it processed, so a crash never applies a message twice.
 */
@Injectable()
export class FixInboxProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(FixInboxProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly db: DbService,
    private readonly rfq: RfqService,
    private readonly orders: OrdersService,
  ) {}

  onApplicationBootstrap() {
    const interval = Number(process.env.FIX_INBOX_POLL_MS ?? 250);
    if (interval > 0) this.timer = setInterval(() => void this.drain(), interval);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Processes all pending inbox messages; returns how many were handled. */
  async drain(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let handled = 0;
    try {
      const rows = await this.db.fixInbox.findMany({
        where: { processedAt: null },
        orderBy: { id: 'asc' },
        take: 100,
      });
      for (const row of rows) {
        await this.handle(row);
        handled++;
      }
    } catch (err) {
      this.log.error(`Inbox drain failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
    return handled;
  }

  private async handle(row: InboxRow) {
    try {
      const bank = await this.db.bank.findFirst({ where: { fixTargetCompId: row.senderCompId } });
      if (!bank) throw new Error(`Unknown bank SenderCompID ${row.senderCompId}`);
      const tenantId = await this.tenantFor(row);
      if (!tenantId) throw new Error('Message does not match any order or quote request');

      await this.db.forTenant(tenantId, async (tx) => {
        const claimed = await tx.$queryRaw<{ id: bigint }[]>`
          SELECT id FROM "FixInbox" WHERE id = ${row.id} AND "processedAt" IS NULL FOR UPDATE SKIP LOCKED`;
        if (claimed.length === 0) return; // another worker has it

        switch (row.msgType) {
          case MsgType.Quote:
            await this.rfq.onQuote(tx, bank.id, row.payload as QuoteMsg);
            break;
          case MsgType.QuoteRequestReject: {
            const p = row.payload as { quoteReqId: string; text?: string };
            this.rfq.logReject(bank.id, p.quoteReqId, p.text);
            break;
          }
          case MsgType.ExecutionReport:
            await this.orders.onExecutionReport(tx, bank.id, row.payload as ExecutionReportMsg);
            break;
          default:
            this.log.warn(`Ignoring unsupported MsgType ${row.msgType}`);
        }
        await tx.fixInbox.update({ where: { id: row.id }, data: { processedAt: new Date() } });
      });
    } catch (err) {
      const message = (err as Error).message;
      this.log.error(`Inbox message ${row.id} (${row.msgType}) failed: ${message}`);
      // Parked for operations to inspect and replay; not retried automatically.
      await this.db.fixInbox.update({
        where: { id: row.id },
        data: { processedAt: new Date(), error: message },
      });
    }
  }

  private async tenantFor(row: InboxRow): Promise<string | undefined> {
    const p = row.payload as { quoteReqId?: string; clOrdId?: string };
    if ((row.msgType === MsgType.Quote || row.msgType === MsgType.QuoteRequestReject) && p.quoteReqId) {
      return (await this.rfq.tenantForQuoteRequest(p.quoteReqId))?.tenantId;
    }
    if (row.msgType === MsgType.ExecutionReport && p.clOrdId) {
      return (await this.orders.tenantForClOrdId(p.clOrdId))?.tenantId;
    }
    return undefined;
  }
}
