import { Module } from '@nestjs/common';
import { ShowcaseController } from './showcase.controller';
import { ShowcaseService } from './showcase.service';

/** Landing-page leads and branded demos for prospect brokers. */
@Module({
  controllers: [ShowcaseController],
  providers: [ShowcaseService],
})
export class ShowcaseModule {}
