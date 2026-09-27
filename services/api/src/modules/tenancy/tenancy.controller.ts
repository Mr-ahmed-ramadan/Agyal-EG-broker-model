import { Controller, Get } from '@nestjs/common';
import type { Tenant } from '@prisma/client';
import { CurrentTenant } from '../../common/auth';
import { tenantConfig } from '../../common/tenant-config';

@Controller('tenant')
export class TenancyController {
  /** Public: branding and enabled products for the broker resolved from the host. */
  @Get()
  current(@CurrentTenant() tenant: Tenant) {
    return {
      slug: tenant.slug,
      legalNameEn: tenant.legalNameEn,
      legalNameAr: tenant.legalNameAr,
      branding: tenant.branding,
      enabledInstrumentTypes: tenantConfig(tenant.config).enabledInstrumentTypes,
    };
  }
}
