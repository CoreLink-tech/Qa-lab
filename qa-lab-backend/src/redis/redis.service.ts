import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Extends ioredis's Redis class directly rather than wrapping it, so
// this service IS a usable Redis client (redisService.get(), .ping(),
// etc.) once injected -- not an extra layer of indirection around one.
@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(config: ConfigService) {
    super({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      password: config.get<string>('redis.password'),
      // Fail relatively fast rather than retrying a broken connection
      // indefinitely -- a health check needs a bounded answer, not a
      // command that hangs.
      maxRetriesPerRequest: 3,
    });

    this.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
