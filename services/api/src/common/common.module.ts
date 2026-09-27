import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { DbService } from './db.service';

@Global()
@Module({
  providers: [DbService, AuditService],
  exports: [DbService, AuditService],
})
export class CommonModule {}
