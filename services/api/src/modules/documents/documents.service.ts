import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { DbService } from '../../common/db.service';
import { EconomicsService } from '../../common/economics.service';
import { cleanRecipient, fillTemplate, isDocToken, newDocToken, primaryLang, shortUserAgent } from '../../domain/documents';
import { waterfall } from '../../domain/economics';
import { documentByKey, DOCUMENTS, type DocumentDef } from './registry';

/** services/api/documents, from src (dev) or dist (production). */
function documentsDir(): string {
  const candidates = [join(process.cwd(), 'documents'), join(__dirname, '..', '..', '..', 'documents'), join(process.cwd(), 'services', 'api', 'documents')];
  return candidates.find((d) => existsSync(join(d, '_style.css'))) ?? candidates[0];
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

export interface OpenContext {
  ip: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  referrer: string | null;
}

@Injectable()
export class DocumentsService {
  private readonly log = new Logger('Documents');

  constructor(
    private readonly db: DbService,
    private readonly economics: EconomicsService,
  ) {}

  // --- Public: open a tracked link ------------------------------------------------------------

  /** The document's HTML for a valid, unrevoked token; the open is logged. Null otherwise. */
  async open(token: string, ctx: OpenContext): Promise<string | null> {
    if (!isDocToken(token)) return null;
    const link = await this.db.asSystem((tx) => tx.documentLink.findUnique({ where: { token } }));
    if (!link || link.revokedAt) return null;
    const doc = documentByKey(link.docKey);
    if (!doc) return null;
    try {
      await this.db.asSystem((tx) =>
        tx.documentOpen.create({
          data: {
            linkId: link.id,
            docKey: link.docKey,
            recipient: link.recipient,
            ip: ctx.ip?.slice(0, 64) ?? null,
            userAgent: ctx.userAgent?.slice(0, 300) ?? null,
            lang: primaryLang(ctx.acceptLanguage),
            referrer: ctx.referrer?.slice(0, 300) ?? null,
          },
        }),
      );
    } catch (err) {
      // Never fail the viewer because logging failed.
      this.log.error(`Could not log document open: ${(err as Error).message}`);
    }
    return this.render(doc);
  }

  /** Fills live values: demo links and QR codes, the economics waterfall, today's date. */
  async render(doc: DocumentDef): Promise<string> {
    const dir = documentsDir();
    const html = readFileSync(join(dir, doc.file), 'utf8');
    const style = readFileSync(join(dir, '_style.css'), 'utf8');
    const client = process.env.PUBLIC_CLIENT_URL ?? 'https://invest.egypt.agyal.net';
    const broker = process.env.PUBLIC_BROKER_URL ?? 'https://broker.egypt.agyal.net';
    const clientDemo = `${client.replace(/\/$/, '')}/?broker=demo-broker`;
    const brokerDemo = `${broker.replace(/\/$/, '')}/?broker=demo-broker`;
    const e = await this.economics.platformDefaults();
    const w = waterfall(e, 'TREASURY_BOND', 0.255, 365);
    const qr = (url: string) => QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#234838', light: '#ffffff' } });
    return fillTemplate(html, {
      STYLE: style,
      CLIENT_APP_URL: clientDemo,
      BROKER_CONSOLE_URL: brokerDemo,
      QR_CLIENT: await qr(clientDemo),
      QR_BROKER: await qr(brokerDemo),
      MARKET_YIELD: pct(w.marketYield),
      CUSTODY: pct(w.custody),
      BROKER_MARGIN: pct(w.brokerMargin),
      AGYAL_MARGIN: pct(w.platformMargin),
      CLIENT_YIELD: pct(w.clientYield),
      TAX_RATE: `${Math.round(w.taxRate * 100)}%`,
      TAX: pct(w.tax),
      NET_YIELD: pct(w.netYield),
      DEPOSIT_RATE: pct(w.depositRate),
      VS_DEPOSIT: `${w.vsDeposit >= 0 ? '+' : '−'}${pct(Math.abs(w.vsDeposit))}`,
      TOTAL_DEDUCTION: pct(w.custody + w.brokerMargin + w.platformMargin),
      TODAY: new Date().toISOString().slice(0, 10),
    });
  }

  // --- Admin ------------------------------------------------------------------------------------

  /** All documents with their open counts. */
  async list() {
    return this.db.asSystem(async (tx) => {
      const counts = await tx.documentOpen.groupBy({ by: ['docKey'], _count: { _all: true }, _max: { openedAt: true } });
      const links = await tx.documentLink.groupBy({ by: ['docKey'], where: { recipient: { not: null } }, _count: { _all: true } });
      return DOCUMENTS.map((d) => ({
        ...d,
        opens: counts.find((c) => c.docKey === d.key)?._count._all ?? 0,
        lastOpenedAt: counts.find((c) => c.docKey === d.key)?._max.openedAt ?? null,
        links: links.find((l) => l.docKey === d.key)?._count._all ?? 0,
      }));
    });
  }

  /** One document: totals, per-recipient engagement (most recently active first) and recent opens. */
  async summary(key: string, baseUrl: string) {
    const doc = documentByKey(key);
    if (!doc) throw new NotFoundException('Unknown document');
    await this.ensureGeneralLink(key);
    return this.db.asSystem(async (tx) => {
      const since = new Date(Date.now() - 7 * 86_400_000);
      const [links, grouped, total, last7, recent] = await Promise.all([
        tx.documentLink.findMany({ where: { docKey: key }, orderBy: { createdAt: 'desc' } }),
        tx.documentOpen.groupBy({ by: ['linkId'], where: { docKey: key }, _count: { _all: true }, _min: { openedAt: true }, _max: { openedAt: true } }),
        tx.documentOpen.count({ where: { docKey: key } }),
        tx.documentOpen.count({ where: { docKey: key, openedAt: { gte: since } } }),
        tx.documentOpen.findMany({ where: { docKey: key }, orderBy: { openedAt: 'desc' }, take: 60 }),
      ]);
      const byLink = new Map(grouped.map((g) => [g.linkId, g]));
      const url = (token: string) => `${baseUrl.replace(/\/$/, '')}/d/${token}`;
      const recipients = links
        .map((l) => {
          const g = byLink.get(l.id);
          return {
            linkId: l.id,
            recipient: l.recipient, // null = general link (unattributed)
            url: url(l.token),
            createdAt: l.createdAt,
            revokedAt: l.revokedAt,
            opens: g?._count._all ?? 0,
            firstOpenedAt: g?._min.openedAt ?? null,
            lastOpenedAt: g?._max.openedAt ?? null,
          };
        })
        .sort((a, b) => (b.lastOpenedAt?.getTime() ?? 0) - (a.lastOpenedAt?.getTime() ?? 0) || b.createdAt.getTime() - a.createdAt.getTime());
      return {
        document: doc,
        totals: { opens: total, recipients: links.filter((l) => l.recipient).length, last7 },
        recipients,
        recent: recent.map((o) => ({
          openedAt: o.openedAt,
          recipient: o.recipient,
          lang: o.lang,
          device: shortUserAgent(o.userAgent),
          ip: o.ip,
        })),
      };
    });
  }

  async createLink(key: string, recipientRaw: string, actorId: string, baseUrl: string) {
    if (!documentByKey(key)) throw new NotFoundException('Unknown document');
    const recipient = cleanRecipient(recipientRaw);
    if (recipient.length < 2) throw new BadRequestException('Enter who you are sending this to');
    const link = await this.db.asSystem((tx) => tx.documentLink.create({ data: { docKey: key, recipient, token: newDocToken(), createdById: actorId } }));
    return { ...link, url: `${baseUrl.replace(/\/$/, '')}/d/${link.token}` };
  }

  async revoke(linkId: string) {
    const link = await this.db.asSystem((tx) => tx.documentLink.findUnique({ where: { id: linkId } }));
    if (!link) throw new NotFoundException('Link not found');
    if (link.revokedAt) return link;
    return this.db.asSystem((tx) => tx.documentLink.update({ where: { id: linkId }, data: { revokedAt: new Date() } }));
  }

  /** Admin preview (not counted as an open). */
  async preview(key: string) {
    const doc = documentByKey(key);
    if (!doc) throw new NotFoundException('Unknown document');
    return this.render(doc);
  }

  private async ensureGeneralLink(key: string) {
    await this.db.asSystem(async (tx) => {
      const existing = await tx.documentLink.findFirst({ where: { docKey: key, recipient: null } });
      if (!existing) await tx.documentLink.create({ data: { docKey: key, recipient: null, token: newDocToken() } });
    });
  }
}
