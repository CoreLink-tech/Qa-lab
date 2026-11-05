import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { Prisma, ScanStatus } from '../generated/prisma/client';
import { SCAN_QUEUE_NAME, type ScanJobPayload } from '../queue/queue.constants';
import { getScannerLibrary } from './scanner-bridge';
import { OrgConcurrencyLimiter } from './org-concurrency.limiter';
import { metrics } from '../observability/metrics';
import { assertSafeExternalUrl } from '../common/security/assert-safe-url';
import { runScanInChild } from './scan-child-runner';

const DEFAULT_SCAN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes wall clock
const DEFAULT_MAX_PAGES = 50;

/**
 * BullMQ worker for scan jobs.
 * Only starts when RUN_MODE is `worker` or `all` (default `all` for local dev).
 * Production: set RUN_MODE=api on the API process and RUN_MODE=worker on workers.
 */
@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);
  private worker: Worker<ScanJobPayload> | null = null;
  private readonly runMode: string;
  private readonly scanTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly orgLimiter: OrgConcurrencyLimiter,
  ) {
    this.runMode = (process.env.RUN_MODE || 'all').toLowerCase();
    this.scanTimeoutMs =
      Number(process.env.SCAN_TIMEOUT_MS) || DEFAULT_SCAN_TIMEOUT_MS;
  }

  onModuleInit(): void {
    if (this.runMode === 'api') {
      this.logger.log('RUN_MODE=api — scan worker not started in this process');
      return;
    }

    const connection = {
      host: this.config.get<string>('redis.host') || 'localhost',
      port: this.config.get<number>('redis.port') || 6379,
      password: this.config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null,
    };

    this.worker = new Worker<ScanJobPayload>(
      SCAN_QUEUE_NAME,
      (job) => this.process(job),
      {
        connection,
        concurrency: Number(process.env.WORKER_CONCURRENCY) || 1,
        lockDuration: this.scanTimeoutMs + 60_000,
        stalledInterval: 30_000,
        maxStalledCount: 2,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Scan job ${job?.id} failed: ${err.message}`,
        err.stack,
      );
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Scan job ${job.id} completed`);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Scan job ${jobId} stalled`);
    });

    this.logger.log(
      `Scan worker listening on "${SCAN_QUEUE_NAME}" (timeout ${this.scanTimeoutMs}ms)`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      this.logger.log('Closing scan worker gracefully…');
      await this.worker.close();
      this.worker = null;
    }
  }

  private async process(job: Job<ScanJobPayload>): Promise<void> {
    const { scanId } = job.data;
    this.logger.log(
      `Processing scan ${scanId} (attempt ${job.attemptsMade + 1})`,
    );

    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        website: { include: { project: true } },
      },
    });

    if (!scan) {
      this.logger.warn(`Scan ${scanId} not found — skipping`);
      return;
    }

    if (
      scan.status === ScanStatus.CANCELLED ||
      scan.status === ScanStatus.COMPLETED
    ) {
      this.logger.log(`Scan ${scanId} status=${scan.status} — skipping`);
      return;
    }

    const organizationId = scan.website.project.organizationId;
    const acquired = await this.orgLimiter.acquire(organizationId);
    if (!acquired) {
      // Soft defer: throw so BullMQ retries with backoff
      throw new Error(
        `Organization ${organizationId} at concurrency limit — retry later`,
      );
    }

    try {
      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          status: ScanStatus.RUNNING,
          startedAt: new Date(),
          error: null,
        },
      });

      const options = (scan.options as Record<string, unknown> | null) || {};
      const maxPages = Math.min(
        (options.maxPages as number) ?? DEFAULT_MAX_PAGES,
        Number(process.env.SCAN_HARD_MAX_PAGES) || 200,
      );

      // Final SSRF check immediately before outbound fetch
      await assertSafeExternalUrl(scan.website.url);

      const useChild =
        (process.env.SCAN_ISOLATION || '').toLowerCase() === 'child';
      const controller = new AbortController();
      let result: {
        status: string;
        pagesScanned?: number;
        error?: string;
        overallScore?: number;
        grade?: string;
        findings?: unknown[];
        recommendations?: unknown[];
        summary?: Record<string, unknown>;
        scanId?: string;
        startUrl?: string;
        startedAt?: string;
        completedAt?: string;
      };

      if (useChild) {
        result = await runScanInChild({
          startUrl: scan.website.url,
          scanId,
          maxPages,
          maxDepth: (options.maxDepth as number) ?? 2,
          concurrency: (options.concurrency as number) ?? 5,
          respectRobotsTxt: (options.respectRobotsTxt as boolean) ?? true,
          checkExposedPaths: (options.checkExposedPaths as boolean) ?? false,
          checkAssets: (options.checkAssets as boolean) ?? false,
          timeoutMs: this.scanTimeoutMs,
        });
      } else {
        const { scan: runScan } = getScannerLibrary();
        result = await this.withTimeout(
          runScan({
            startUrl: scan.website.url,
            scanId,
            maxPages,
            maxDepth: (options.maxDepth as number) ?? 2,
            concurrency: (options.concurrency as number) ?? 5,
            respectRobotsTxt: (options.respectRobotsTxt as boolean) ?? true,
            checkExposedPaths: (options.checkExposedPaths as boolean) ?? false,
            checkAssets: (options.checkAssets as boolean) ?? false,
            writeReports: false,
            signal: controller.signal,
            onProgress: (event: { type?: string; pagesScanned?: number }) => {
              if (event.type === 'page' && event.pagesScanned != null) {
                void this.prisma.scan
                  .update({
                    where: { id: scanId },
                    data: { pagesScanned: event.pagesScanned },
                  })
                  .catch(() => undefined);
              }
            },
          }),
          this.scanTimeoutMs,
          scanId,
          controller,
        );
      }

      const current = await this.prisma.scan.findUnique({
        where: { id: scanId },
        select: { status: true },
      });
      if (current?.status === ScanStatus.CANCELLED) {
        this.logger.log(`Scan ${scanId} was cancelled during run`);
        return;
      }

      if (result.status === 'failed' || result.status === 'cancelled') {
        await this.prisma.scan.update({
          where: { id: scanId },
          data: {
            status:
              result.status === 'cancelled'
                ? ScanStatus.CANCELLED
                : ScanStatus.FAILED,
            completedAt: new Date(),
            pagesScanned: result.pagesScanned ?? 0,
            error: result.error || 'Scan failed',
          },
        });
        return;
      }

      const findings = Array.isArray(result.findings) ? result.findings : [];
      const reportJson = {
        scanId: result.scanId,
        startUrl: result.startUrl,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        status: result.status,
        pagesScanned: result.pagesScanned,
        overallScore: result.overallScore,
        grade: result.grade,
        findings,
        recommendations: result.recommendations ?? [],
        summary: result.summary ?? {},
      };

      const reportStr = JSON.stringify(reportJson);
      const maxBytes = Number(process.env.REPORT_JSON_MAX_BYTES) || 2_000_000;
      if (Buffer.byteLength(reportStr, 'utf8') > maxBytes) {
        // Truncate findings to fit
        reportJson.findings = findings.slice(0, 100);
        reportJson.summary = {
          ...(reportJson.summary as object),
          truncated: true,
          originalFindingCount: findings.length,
        };
      }

      metrics.scansCompleted.inc();

      await this.prisma.$transaction([
        this.prisma.report.create({
          data: {
            scanId,
            score: Math.round(result.overallScore ?? 0),
            grade: result.grade ?? 'F',
            issueCount: findings.length,
            reportJson: reportJson as Prisma.InputJsonValue,
            reportHtml: null,
          },
        }),
        this.prisma.scan.update({
          where: { id: scanId },
          data: {
            status: ScanStatus.COMPLETED,
            completedAt: new Date(),
            pagesScanned: result.pagesScanned ?? 0,
            error: null,
          },
        }),
      ]);

      this.logger.log(
        `Scan ${scanId} completed — score ${String(result.overallScore)} (${String(result.grade)}), ${findings.length} findings`,
      );
    } catch (error) {
      const message = (error as Error).message || String(error);
      this.logger.error(
        `Scan ${scanId} threw: ${message}`,
        (error as Error).stack,
      );

      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          status: ScanStatus.FAILED,
          completedAt: new Date(),
          error: message.slice(0, 2000),
        },
      });

      metrics.scansFailed.inc();
      throw error;
    } finally {
      await this.orgLimiter.release(organizationId);
    }
  }

  /**
   * Race the scan promise against a wall-clock timer. On timeout, abort the
   * AbortController so the scanner/crawler can stop fetching new pages
   * instead of only rejecting the outer promise while work continues.
   */
  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    scanId: string,
    controller?: AbortController,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          /* ignore */
        }
        reject(
          new Error(`Scan ${scanId} exceeded wall-clock timeout of ${ms}ms`),
        );
      }, ms);
      promise
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }
}
