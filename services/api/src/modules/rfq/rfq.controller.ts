import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { RfqService } from './rfq.service';

const RfqSchema = z.object({
  isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/, 'ISIN'),
  quantity: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

@Controller('rfq')
@Auth('CLIENT')
export class RfqController {
  constructor(private readonly rfq: RfqService) {}

  @Post()
  create(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.rfq.create(t, u.clientId!, parseBody(RfqSchema, body));
  }

  @Get(':id')
  get(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.rfq.get(t, u.clientId!, id);
  }
}
