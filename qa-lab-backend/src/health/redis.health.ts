import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

const DEFAULT_TIMEOUT_MS = 1000;

// No built-in Redis indicator ships with @nestjs/terminus (unlike
// Prisma/TypeORM/Mongoose, which it does support), so this is a small
// custom one following the same HealthIndicatorService pattern
// PrismaHealthIndicator uses internally.
@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

  async pingCheck<Key extends string>(
    key: Key,
    redis: RedisService,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<HealthIndicatorResult<Key>> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.pingWithTimeout(redis, timeoutMs);
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }

  private pingWithTimeout(redis: RedisService, timeoutMs: number): Promise<unknown> {
    return Promise.race([
      redis.ping(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out')), timeoutMs),
      ),
    ]);
  }
}
