import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { assertProductionConfig } from './common/config-check';

async function bootstrap() {
  assertProductionConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Render/Vercel proxies: use the client's IP from X-Forwarded-For (consents, audit).
  app.set('trust proxy', 1);
  if (process.env.DEMO_MODE === 'true') {
    new Logger('Bootstrap').warn('DEMO_MODE is on: coupons/redemptions can be confirmed before their payment date');
  }
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176').split(','),
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant', 'X-Tenant-Host'],
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
