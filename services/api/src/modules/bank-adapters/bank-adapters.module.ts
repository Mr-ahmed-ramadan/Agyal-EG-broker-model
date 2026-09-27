import { Module } from '@nestjs/common';
import { FixOutboxService } from './fix-outbox.service';

/**
 * Bank connectivity on the API side (ADR 0004): the FIX outbox consumed by the
 * FIX gateway. PORTAL and FILE adapters emitting the same messages come next.
 */
@Module({
  providers: [FixOutboxService],
  exports: [FixOutboxService],
})
export class BankAdaptersModule {}
