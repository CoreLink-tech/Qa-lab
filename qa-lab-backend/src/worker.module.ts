import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { ScanProcessor } from './scans/scan.processor';
import { OrgConcurrencyLimiter } from './scans/org-concurrency.limiter';
import { ScanReaperService } from './scans/scan-reaper.service';

/**
 * Minimal module for the dedicated worker process.
 * No HTTP controllers — only queue consumer + reaper.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
  ],
  providers: [OrgConcurrencyLimiter, ScanProcessor, ScanReaperService],
})
export class WorkerModule {}
