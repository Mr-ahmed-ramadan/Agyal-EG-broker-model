import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { RfqModule } from '../rfq/rfq.module';
import { FixInboxProcessor } from './fix-inbox.processor';

/** Routes inbound bank messages (Quote, ExecutionReport) to their tenant (ADR 0004). */
@Module({
  imports: [RfqModule, OrdersModule],
  providers: [FixInboxProcessor],
})
export class FixInboxModule {}
