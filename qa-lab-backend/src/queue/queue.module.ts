import { Global, Module } from '@nestjs/common';
import { ScanQueueService } from './scan-queue.service';

@Global()
@Module({
  providers: [ScanQueueService],
  exports: [ScanQueueService],
})
export class QueueModule {}
