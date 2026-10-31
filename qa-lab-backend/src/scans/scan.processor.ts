import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { ScanStatus } from '../generated/prisma/client';
import {
  SCAN_QUEUE_NAME,
  type ScanJobPayload,
} from '../queue/queue.constants';
import { getScannerLibrary } from './scanner-bridge';

/**
 * In-process BullMQ worker that runs the QA Lab scanner library against a
 * queued Scan row and persists the Report.
 *
 * Runs inside the API process for local/dev simplicity. Production can split
 * this into a dedicated worker process using the same processor logic.
 */
@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);
  private worker: Worker<ScanJobPayload> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const connection = {
      host: this.config.get<string>('redis.host') || 'localhost',
      port: this.config.get<number>('redis.port') || 6379,
      password: this.config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null as null,
    };

    this.worker = new Worker<ScanJobPayload>(
      SCAN_QUEUE_NAME,
      (job) => this.process(job),
      {
        connection,
        concurrency: 1,
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

    this.logger.log(`Scan worker listening on queue "${SCAN_QUEUE_NAME}"`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async process(job: Job<ScanJobPayload>): Promise<void> {
    const { scanId } = job.data;
    this.logger.log(`Processing scan ${scanId}`);

    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        website: true,
      },
    });

    if (!scan) {
      this.logger.warn(`Scan ${scanId} not found — skipping`);
      return;
    }

    if (scan.status === ScanStatus.CANCELLED) {
      this.logger.log(`Scan ${scanId} already cancelled — skipping`);
      return;
    }

    await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        status: ScanStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    const options = (scan.options as Record<string, unknown> | null) || {};

    try {
      const { scan: runScan } = getScannerLibrary();

      const result = await runScan({
        startUrl: scan.website.url,
        scanId,
        maxPages: (options.maxPages as number) ?? 50,
        maxDepth: (options.maxDepth as number) ?? 2,
        concurrency: (options.concurrency as number) ?? 5,
        respectRobotsTxt: (options.respectRobotsTxt as boolean) ?? true,
        checkExposedPaths: (options.checkExposedPaths as boolean) ?? false,
        checkAssets: (options.checkAssets as boolean) ?? false,
        writeReports: false,
        onProgress: (event) => {
          if (event.type === 'page' && event.pagesScanned != null) {
            // Fire-and-forget progress update
            void this.prisma.scan
              .update({
                where: { id: scanId },
                data: { pagesScanned: event.pagesScanned },
              })
              .catch(() => undefined);
          }
        },
      });

      // Re-check cancellation mid-flight
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

      await this.prisma.$transaction([
        this.prisma.report.create({
          data: {
            scanId,
            score: Math.round(result.overallScore ?? 0),
            grade: result.grade ?? 'F',
            issueCount: findings.length,
            reportJson,
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
        `Scan ${scanId} completed — score ${result.overallScore} (${result.grade}), ${findings.length} findings`,
      );
    } catch (error) {
      const message = (error as Error).message || String(error);
      this.logger.error(`Scan ${scanId} threw: ${message}`, (error as Error).stack);

      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          status: ScanStatus.FAILED,
          completedAt: new Date(),
          error: message.slice(0, 2000),
        },
      });

      // Re-throw so BullMQ records the failure / can retry if configured
      throw error;
    }
  }
}
