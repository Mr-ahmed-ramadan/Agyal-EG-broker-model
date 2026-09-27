import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentTenant, CurrentUser, type AuthUser } from '../../common/auth';
import { parseBody } from '../../common/validation';
import { OrdersService } from './orders.service';

const AcceptSchema = z.object({ quoteId: z.string().uuid() });

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  @Auth('CLIENT')
  accept(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Body() body: unknown) {
    return this.orders.accept(t, u.sub, u.clientId!, parseBody(AcceptSchema, body).quoteId);
  }

  @Get('orders')
  @Auth('CLIENT')
  mine(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser) {
    return this.orders.list(t, u.clientId!);
  }

  @Get('orders/:id')
  @Auth('CLIENT')
  one(@CurrentTenant() t: Tenant, @CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.orders.get(t, u.clientId!, id);
  }

  @Get('broker/orders')
  @Auth('BROKER_DEALER', 'BROKER_OPS', 'BROKER_ADMIN', 'BROKER_COMPLIANCE')
  all(@CurrentTenant() t: Tenant) {
    return this.orders.list(t);
  }
}
