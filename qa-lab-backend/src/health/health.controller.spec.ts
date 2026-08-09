import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: { check: jest.Mock };

  beforeEach(async () => {
    healthCheckService = {
      // The real HealthCheckService.check() invokes each provided
      // function so it can collect results; mimic that here so the
      // test actually exercises the closures passed to it, not just
      // that check() was called with "some array".
      check: jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
        const results = await Promise.all(indicators.map((fn) => fn()));
        return { status: 'ok', details: Object.assign({}, ...results) };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        {
          provide: MemoryHealthIndicator,
          useValue: { checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }) },
        },
        {
          provide: PrismaHealthIndicator,
          useValue: { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) },
        },
        { provide: PrismaService, useValue: {} },
        {
          provide: RedisHealthIndicator,
          useValue: { pingCheck: jest.fn().mockResolvedValue({ redis: { status: 'up' } }) },
        },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('checks memory, database, and redis together', async () => {
    const result = await controller.check();
    expect(healthCheckService.check).toHaveBeenCalledTimes(1);
    expect(result.details.memory_heap.status).toBe('up');
    expect(result.details.database.status).toBe('up');
    expect(result.details.redis.status).toBe('up');
  });

  it('surfaces a down status from any one indicator (e.g. database) without hiding it', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        {
          provide: MemoryHealthIndicator,
          useValue: { checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }) },
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {
            pingCheck: jest.fn().mockResolvedValue({ database: { status: 'down', message: 'no connection' } }),
          },
        },
        { provide: PrismaService, useValue: {} },
        {
          provide: RedisHealthIndicator,
          useValue: { pingCheck: jest.fn().mockResolvedValue({ redis: { status: 'up' } }) },
        },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    const brokenController = module.get(HealthController);
    const result = await brokenController.check();
    expect(result.details.database.status).toBe('down');
    expect(result.details.database.message).toBe('no connection');
  });
});
