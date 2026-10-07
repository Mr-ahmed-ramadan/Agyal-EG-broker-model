import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Auth } from '../../common/auth';
import { csvTable } from '../../common/csv.util';
import { parseBody } from '../../common/validation';
import { PlatformDataService } from './platform-data.service';

const Paging = { skip: z.coerce.number().int().min(0).default(0), take: z.coerce.number().int().min(1).max(200).default(50) };
const RowsSchema = z.object({ ...Paging, field: z.string().max(60).optional(), value: z.string().max(200).optional() });
const AuditSchema = z.object({
  ...Paging,
  type: z.enum(['actions', 'changes']).default('actions'),
  tenant: z.string().max(60).optional(),
  actor: z.string().max(120).optional(),
  action: z.string().max(120).optional(),
  entity: z.string().max(60).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  text: z.string().max(120).optional(),
});

/** Agyal admin: read-only data console, 360° views and the audit trail. */
@Controller('admin')
@Auth('PLATFORM_ADMIN')
export class PlatformDataController {
  constructor(private readonly data: PlatformDataService) {}

  @Get('data/tables')
  tables() {
    return this.data.tables();
  }

  @Get('data/tables/:table')
  rows(@Param('table') table: string, @Query() query: unknown) {
    const q = parseBody(RowsSchema, query);
    return this.data.rows(table, q.skip, q.take, q.field, q.value);
  }

  @Get('data/search')
  search(@Query('q') q = '') {
    return this.data.search(q);
  }

  @Get('data/360/:kind/:id')
  view360(@Param('kind') kind: string, @Param('id') id: string) {
    return this.data.view360(kind, id);
  }

  @Get('audit')
  audit(@Query() query: unknown) {
    return this.data.audit(parseBody(AuditSchema, query));
  }

  /** CSV of the filtered audit trail (up to 5,000 rows). */
  @Get('audit/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@Query() query: unknown, @Res() res: Response) {
    const q = parseBody(AuditSchema, { ...(query as object), skip: 0, take: 200 });
    const rows: Record<string, unknown>[] = [];
    for (let skip = 0; skip < 5000; skip += 200) {
      const page = await this.data.audit({ ...q, skip, take: 200 });
      rows.push(...(page.rows as Record<string, unknown>[]));
      if (page.rows.length < 200) break;
    }
    const cols =
      q.type === 'changes'
        ? ['at', 'tenant', 'actor', 'op', 'tableName', 'rowId', 'requestId', 'changes']
        : ['createdAt', 'tenant', 'actor', 'action', 'entity', 'entityId', 'outcome', 'ip', 'userAgent', 'requestId', 'data'];
    res.setHeader('Content-Disposition', `attachment; filename="agyal-audit-${q.type}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvTable(cols, rows));
  }
}
