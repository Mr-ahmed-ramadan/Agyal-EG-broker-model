import { Module } from '@nestjs/common';
import { InvestorCodeController } from './investor-code.controller';
import { InvestorCodeService } from './investor-code.service';
import { MCDR_ADAPTER, ManualMcdrAdapter } from './mcdr.adapter';

/** MCDR unified code and custody accounts (ADR 0006). */
@Module({
  controllers: [InvestorCodeController],
  providers: [InvestorCodeService, { provide: MCDR_ADAPTER, useClass: ManualMcdrAdapter }],
  exports: [InvestorCodeService],
})
export class InvestorCodeModule {}
