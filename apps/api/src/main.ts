import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { API_CONFIG, type ApiConfig } from './config';
import { configureHttp } from './http';

// Vercel detects src/main.ts and supports the standard NestJS listen bootstrap.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ApiConfig>(API_CONFIG);
  configureHttp(app, config);
  app.enableShutdownHooks();
  await app.listen(config.port);
}

void bootstrap().catch(() => {
  console.error(
    'Unable to start the API. Check the server environment configuration.',
  );
  process.exitCode = 1;
});
