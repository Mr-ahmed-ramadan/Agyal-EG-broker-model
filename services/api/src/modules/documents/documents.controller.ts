import { Body, Controller, Get, Header, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { DocumentsService } from './documents.service';

const LinkSchema = z.object({ recipient: z.string().trim().min(2).max(120) });

/** Base URL for tracked links: PUBLIC_DOCS_URL, else this API's own address. */
function baseUrl(req: Request): string {
  return process.env.PUBLIC_DOCS_URL ?? `${req.protocol}://${req.get('host')}`;
}

const NOT_AVAILABLE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Link not available</title>
<body style="font-family:Inter,system-ui,sans-serif;background:#fbfaf5;color:#22302a;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center;padding:24px"><h1 style="font-family:Georgia,serif;color:#234838">This link is not available</h1>
<p>It may have expired or been withdrawn. Please ask the person who sent it to you for a new link.</p></div></body></html>`;

@Controller()
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  /** Public: a tracked document link. Every open is logged against the recipient. */
  @Get('d/:token')
  async open(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const html = await this.docs.open(token, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      acceptLanguage: req.headers['accept-language'] ?? null,
      referrer: (req.headers.referer as string | undefined) ?? null,
    });
    res.status(html ? 200 : 404).type('html').send(html ?? NOT_AVAILABLE);
  }

  @Get('admin/documents')
  @Auth('PLATFORM_ADMIN')
  list() {
    return this.docs.list();
  }

  @Get('admin/documents/:key')
  @Auth('PLATFORM_ADMIN')
  summary(@Param('key') key: string, @Req() req: Request) {
    return this.docs.summary(key, baseUrl(req));
  }

  @Post('admin/documents/:key/links')
  @Auth('PLATFORM_ADMIN')
  create(@Param('key') key: string, @CurrentUser() u: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.docs.createLink(key, parseBody(LinkSchema, body).recipient, u.sub, baseUrl(req));
  }

  @Post('admin/documents/links/:id/revoke')
  @Auth('PLATFORM_ADMIN')
  revoke(@Param('id') id: string) {
    return this.docs.revoke(id);
  }

  /** Admin preview of a document (not counted as an open). */
  @Get('admin/documents/:key/preview')
  @Auth('PLATFORM_ADMIN')
  @Header('Content-Type', 'text/html; charset=utf-8')
  preview(@Param('key') key: string) {
    return this.docs.preview(key);
  }
}
