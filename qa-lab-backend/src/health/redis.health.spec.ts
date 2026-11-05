import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { RedisService } from '../redis/redis.service';

function fakeRedis(pingImpl: () => Promise<unknown>): RedisService {
  return { ping: pingImpl } as unknown as RedisService;
}

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(() => {
    indicator = new RedisHealthIndicator(new HealthIndicatorService());
  });

  it('reports up when ping succeeds', async () => {
    const redis = fakeRedis(() => Promise.resolve('PONG'));
    const result = await indicator.pingCheck('redis', redis);
    expect(result.redis.status).toBe('up');
  });

  it('reports down with the error message when ping rejects', async () => {
    const redis = fakeRedis(() =>
      Promise.reject(new Error('connection refused')),
    );
    const result = await indicator.pingCheck('redis', redis);
    expect(result.redis.status).toBe('down');
    expect(result.redis.message).toMatch(/connection refused/);
  });

  it('reports down when the ping takes longer than the timeout', async () => {
    const redis = fakeRedis(
      () => new Promise((resolve) => setTimeout(() => resolve('PONG'), 200)),
    );
    const result = await indicator.pingCheck('redis', redis, 20);
    expect(result.redis.status).toBe('down');
    expect(result.redis.message).toMatch(/timed out/);
  });

  it('uses the provided key in the result object', async () => {
    const redis = fakeRedis(() => Promise.resolve('PONG'));
    const result = await indicator.pingCheck('my_custom_key', redis);
    expect(result.my_custom_key).toBeDefined();
  });
});
