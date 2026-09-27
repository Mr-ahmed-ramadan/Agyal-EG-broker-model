import { Module } from '@nestjs/common';
import { PlatformDataController } from './platform-data.controller';
import { PlatformDataService } from './platform-data.service';

/** Data console (read only), 360° views and audit trail for Agyal admins. */
@Module({
  controllers: [PlatformDataController],
  providers: [PlatformDataService],
})
export class PlatformDataModule {}
