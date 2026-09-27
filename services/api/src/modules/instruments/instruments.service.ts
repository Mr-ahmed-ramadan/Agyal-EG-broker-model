import { Injectable, NotFoundException } from '@nestjs/common';
import type { Instrument, Tenant } from '@prisma/client';
import { DbService } from '../../common/db.service';
import { tenantConfig } from '../../common/tenant-config';

@Injectable()
export class InstrumentsService {
  constructor(private readonly db: DbService) {}

  list(tenant: Tenant) {
    const enabled = tenantConfig(tenant.config).enabledInstrumentTypes;
    return this.db.instrument.findMany({
      where: { type: { in: enabled as Instrument['type'][] }, maturityDate: { gt: new Date() } },
      orderBy: [{ type: 'asc' }, { maturityDate: 'asc' }],
    });
  }

  async byIsin(tenant: Tenant, isin: string): Promise<Instrument> {
    const instrument = await this.db.instrument.findUnique({ where: { isin } });
    const enabled = tenantConfig(tenant.config).enabledInstrumentTypes;
    if (!instrument || !enabled.includes(instrument.type)) {
      throw new NotFoundException('Instrument not available');
    }
    return instrument;
  }
}
