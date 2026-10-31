import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulesService } from './schedules.service';

/**
 * Lightweight in-process ticker that checks for due ScanSchedule rows.
 * Runs every 60s. Suitable for single-instance deploys; multi-instance
 * should move this to a dedicated worker with a distributed lock.
 */
@Injectable()
export class ScheduleTickerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduleTickerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly schedules: SchedulesService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    // First pass shortly after boot
    setTimeout(() => void this.tick(), 5_000);
    this.logger.log('Schedule ticker started (60s interval)');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      const n = await this.schedules.processDueSchedules();
      if (n > 0) {
        this.logger.log(`Enqueued ${n} scheduled scan(s)`);
      }
    } catch (err) {
      this.logger.error(`Ticker error: ${(err as Error).message}`);
    }
  }
}
