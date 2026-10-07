import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { assertProductionConfig } from './common/config-check';
import { originChecker, parseOrigins } from './common/cors';

async function bootstrap() {
  assertProductionConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Prospect logos arrive as data URLs (up to 200 KB); allow room for them.
  app.useBodyParser('json', { limit: '512kb' });
  // Behind Render/Vercel proxies: use the client's IP from X-Forwarded-For (consents, audit).
  app.set('trust proxy', 1);
  if (process.env.DEMO_MODE === 'true') {
    new Logger('Bootstrap').warn('DEMO_MODE is on: coupons/redemptions can be confirmed before their payment date');
  }
  const allowedOrigins = parseOrigins(
    process.env.CORS_ORIGINS ??
      'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177',
  );
  const refused = new Set<string>();
  app.enableCors({
    origin: originChecker(allowedOrigins, (origin) => {
      if (refused.has(origin)) return;
      refused.add(origin);
      new Logger('CORS').warn(`Refused origin ${origin} (allowed: ${allowedOrigins.join(', ')}); check CORS_ORIGINS`);
    }),
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant', 'X-Tenant-Host'],
    // The consoles are served from a different origin to the API, so without
    // this the browser hides Content-Disposition and every CSV export saves as
    // "export.csv" instead of the name the endpoint chose.
    exposedHeaders: ['Content-Disposition'],
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
