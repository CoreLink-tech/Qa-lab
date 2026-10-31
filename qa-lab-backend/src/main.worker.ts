/**
 * Dedicated worker process entrypoint.
 * Does not serve HTTP. Set RUN_MODE=worker.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  process.env.RUN_MODE = process.env.RUN_MODE || 'worker';
  const logger = new Logger('WorkerBootstrap');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  logger.log('QA Lab scan worker started (no HTTP)');

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker…`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start QA Lab worker:', error);
  process.exit(1);
});
