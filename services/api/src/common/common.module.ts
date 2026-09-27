import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { DbService } from './db.service';
import { EconomicsService } from './economics.service';

@Global()
@Module({
  providers: [DbService, AuditService, EconomicsService],
  exports: [DbService, AuditService, EconomicsService],
})
export class CommonModule {}
