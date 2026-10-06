import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';

/** Awareness campaign: public calculator, demo accounts, waitlist and demand. */
@Module({
  imports: [IdentityModule, LedgerModule],
  controllers: [CampaignController],
  providers: [CampaignService],
})
export class CampaignModule {}
