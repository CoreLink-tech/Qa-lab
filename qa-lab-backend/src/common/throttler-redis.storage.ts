import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

/**
 * Shared rate-limit counters across API instances via Redis.
 */
@Injectable()
export class ThrottlerRedisStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('redis.host') || 'localhost',
      port: config.get<number>('redis.port') || 6379,
      password: config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    void this.redis.connect().catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${throttlerName}:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.pexpire(redisKey, ttl);
    }
    const pttl = await this.redis.pttl(redisKey);
    const isBlocked = count > limit;
    return {
      totalHits: count,
      timeToExpire: pttl > 0 ? pttl : ttl,
      isBlocked,
      timeToBlockExpire: isBlocked ? blockDuration || ttl : 0,
    };
  }
}
