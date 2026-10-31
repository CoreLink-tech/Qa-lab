import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — process is up (no dependency checks). */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness — DB + Redis must be reachable. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.redisHealth.pingCheck('redis', this.redis),
    ]);
  }

  /** Full health (legacy + detailed). */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.redisHealth.pingCheck('redis', this.redis),
    ]);
  }
}
