import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Deletes old reports, audit logs, and expired tokens.
 * Runs on worker/all only.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const mode = (process.env.RUN_MODE || 'all').toLowerCase();
    if (mode === 'api') return;
    // Daily
    this.timer = setInterval(() => void this.run(), 24 * 60 * 60 * 1000);
    setTimeout(() => void this.run(), 60_000);
    this.logger.log('Retention job scheduled (daily)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    const reportDays = Number(process.env.RETENTION_REPORT_DAYS) || 90;
    const auditDays = Number(process.env.RETENTION_AUDIT_DAYS) || 180;
    const now = Date.now();
    const reportCutoff = new Date(now - reportDays * 86400000);
    const auditCutoff = new Date(now - auditDays * 86400000);

    try {
      const reports = await this.prisma.report.deleteMany({
        where: { createdAt: { lt: reportCutoff } },
      });
      const audits = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: auditCutoff } },
      });
      const tokens = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { not: null, lt: auditCutoff } },
          ],
        },
      });
      this.logger.log(
        `Retention: reports=${reports.count} audits=${audits.count} tokens=${tokens.count}`,
      );
    } catch (err) {
      this.logger.error(`Retention failed: ${(err as Error).message}`);
    }
  }
}
