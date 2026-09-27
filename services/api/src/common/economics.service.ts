import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, Tenant } from '@prisma/client';
import {
  DEFAULT_ECONOMICS,
  economicsProblems,
  mergeEconomics,
  pricingRuleFor,
  type Economics,
  type EconomicsOverrides,
} from '../domain/economics';
import type { InstrumentType, PricingRule } from '../domain/pricing';
import { DbService } from './db.service';

const KEY = 'economics';
const CACHE_MS = 30_000;

/**
 * Economics for a broker (ADR 0008): Agyal's platform defaults with the
 * broker's overrides from Tenant.config.economics on top. Platform defaults are
 * cached briefly; saving them clears the cache.
 */
@Injectable()
export class EconomicsService {
  private cache: { at: number; value: Economics } | null = null;

  constructor(private readonly db: DbService) {}

  async platformDefaults(): Promise<Economics> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const row = await this.db.platformSetting.findUnique({ where: { key: KEY } });
    const value = mergeEconomics(DEFAULT_ECONOMICS, (row?.value ?? null) as EconomicsOverrides | null);
    this.cache = { at: Date.now(), value };
    return value;
  }

  overridesOf(tenant: Pick<Tenant, 'config'>): EconomicsOverrides {
    return ((tenant.config as { economics?: EconomicsOverrides } | null)?.economics ?? {}) as EconomicsOverrides;
  }

  async forTenant(tenant: Pick<Tenant, 'config'>): Promise<Economics> {
    return mergeEconomics(await this.platformDefaults(), this.overridesOf(tenant));
  }

  async rule(tenant: Pick<Tenant, 'config'>): Promise<PricingRule> {
    return pricingRuleFor(await this.forTenant(tenant));
  }

  async taxRate(tenant: Pick<Tenant, 'config'>, type: string): Promise<number> {
    return (await this.forTenant(tenant)).taxRates[type as InstrumentType] ?? DEFAULT_ECONOMICS.taxRates.TREASURY_BOND;
  }

  /** Platform admin: replace the platform defaults. */
  async savePlatformDefaults(value: Economics, actorId: string): Promise<Economics> {
    const merged = mergeEconomics(DEFAULT_ECONOMICS, value);
    const problems = economicsProblems(merged);
    if (problems.length) throw new BadRequestException(problems.join('; '));
    await this.db.asSystem((tx) => tx.platformSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: merged as unknown as Prisma.InputJsonValue, updatedBy: actorId },
      update: { value: merged as unknown as Prisma.InputJsonValue, updatedBy: actorId },
    }));
    this.cache = null;
    return merged;
  }

  /** Platform admin: validate a broker's overrides against the current defaults. */
  async validateOverrides(overrides: EconomicsOverrides): Promise<Economics> {
    const merged = mergeEconomics(await this.platformDefaults(), overrides);
    const problems = economicsProblems(merged);
    if (problems.length) throw new BadRequestException(problems.join('; '));
    return merged;
  }
}
