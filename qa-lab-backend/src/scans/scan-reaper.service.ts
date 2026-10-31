import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ScanStatus } from '../generated/prisma/client';

/**
 * Marks scans stuck in RUNNING past a threshold as FAILED.
 * Only runs when RUN_MODE is worker or all.
 */
@Injectable()
export class ScanReaperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanReaperService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly stuckMs: number;

  constructor(private readonly prisma: PrismaService) {
    this.stuckMs =
      Number(process.env.SCAN_STUCK_MS) || 20 * 60 * 1000; // 20 minutes
  }

  onModuleInit(): void {
    const mode = (process.env.RUN_MODE || 'all').toLowerCase();
    if (mode === 'api') return;

    this.timer = setInterval(() => void this.reap(), 60_000);
    setTimeout(() => void this.reap(), 15_000);
    this.logger.log(`Scan reaper started (stuck > ${this.stuckMs}ms)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async reap(): Promise<void> {
    const cutoff = new Date(Date.now() - this.stuckMs);
    try {
      const result = await this.prisma.scan.updateMany({
        where: {
          status: ScanStatus.RUNNING,
          startedAt: { lt: cutoff },
        },
        data: {
          status: ScanStatus.FAILED,
          completedAt: new Date(),
          error: `Marked failed by reaper: stuck in RUNNING longer than ${this.stuckMs}ms`,
        },
      });
      if (result.count > 0) {
        this.logger.warn(`Reaper failed ${result.count} stuck scan(s)`);
      }
    } catch (err) {
      this.logger.error(`Reaper error: ${(err as Error).message}`);
    }
  }
}
