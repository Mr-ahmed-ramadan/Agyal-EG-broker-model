import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';

/** Awareness campaign: public calculator, waitlist and the demand picture. */
@Module({
  controllers: [CampaignController],
  providers: [CampaignService],
})
export class CampaignModule {}
