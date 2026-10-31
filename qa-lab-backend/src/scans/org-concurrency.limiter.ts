import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Limits concurrent RUNNING scans per organization so one tenant cannot
 * monopolize the worker pool.
 */
@Injectable()
export class OrgConcurrencyLimiter implements OnModuleDestroy {
  private readonly logger = new Logger(OrgConcurrencyLimiter.name);
  private readonly redis: Redis;
  private readonly maxPerOrg: number;

  constructor(config: ConfigService) {
    this.maxPerOrg = Number(process.env.ORG_SCAN_CONCURRENCY) || 2;
    this.redis = new Redis({
      host: config.get<string>('redis.host') || 'localhost',
      port: config.get<number>('redis.port') || 6379,
      password: config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    void this.redis.connect().catch((err) => {
      this.logger.warn(`Org concurrency Redis connect: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async acquire(organizationId: string): Promise<boolean> {
    const key = `org-scan-concurrency:${organizationId}`;
    const n = await this.redis.incr(key);
    if (n === 1) {
      await this.redis.expire(key, 3600);
    }
    if (n > this.maxPerOrg) {
      await this.redis.decr(key);
      return false;
    }
    return true;
  }

  async release(organizationId: string): Promise<void> {
    const key = `org-scan-concurrency:${organizationId}`;
    const n = await this.redis.decr(key);
    if (n < 0) {
      await this.redis.set(key, '0');
    }
  }
}
