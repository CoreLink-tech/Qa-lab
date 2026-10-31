import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { WebsitesModule } from './websites/websites.module';
import { ScansModule } from './scans/scans.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SchedulesModule } from './schedules/schedules.module';
import { AuditModule } from './audit/audit.module';
import { QueueModule } from './queue/queue.module';
import { EmailModule } from './email/email.module';
import { QuotasModule } from './quotas/quotas.module';
import { DomainVerifyModule } from './domain-verify/domain-verify.module';
import { ThrottlerRedisStorage } from './common/throttler-redis.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const storage = new ThrottlerRedisStorage(config);
        return {
          throttlers: [
            { name: 'default', ttl: 60_000, limit: 120 },
            { name: 'auth', ttl: 60_000, limit: 20 },
          ],
          storage,
        };
      },
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    AuditModule,
    EmailModule,
    QuotasModule,
    DomainVerifyModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    WebsitesModule,
    ScansModule,
    ApiKeysModule,
    SchedulesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
