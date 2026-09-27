import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { TenancyController } from './tenancy.controller';

/** Tenants, branding, per-tenant config, bank relationships (ADR 0002). */
@Module({
  controllers: [TenancyController, AdminController],
})
export class TenancyModule {}
