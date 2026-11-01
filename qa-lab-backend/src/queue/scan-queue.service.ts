import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { SCAN_QUEUE_NAME, type ScanJobPayload } from './queue.constants';

@Injectable()
export class ScanQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanQueueService.name);
  private queue: Queue<ScanJobPayload> | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.queue = new Queue<ScanJobPayload>(SCAN_QUEUE_NAME, {
      connection: {
        host: this.config.get<string>('redis.host') || 'localhost',
        port: this.config.get<number>('redis.port') || 6379,
        password: this.config.get<string>('redis.password') || undefined,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    this.logger.log(`Scan queue "${SCAN_QUEUE_NAME}" ready`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  async enqueue(payload: ScanJobPayload): Promise<string> {
    if (!this.queue) {
      throw new Error('Scan queue is not initialized');
    }

    const job = await this.queue.add('run-scan', payload, {
      // Use scanId as jobId so we can look it up / remove it later
      jobId: payload.scanId,
    });

    return job.id || payload.scanId;
  }

  async removeJob(scanId: string): Promise<void> {
    if (!this.queue) return;
    const job = await this.queue.getJob(scanId);
    if (job) {
      await job.remove();
    }
  }
}
