import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ScanQueueService } from '../queue/scan-queue.service';
import { WebsitesModule } from '../websites/websites.module';
import { ScanProcessor } from './scan.processor';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

@Module({
  imports: [WebsitesModule, OrganizationsModule],
  controllers: [ScansController],
  providers: [ScansService, ScanQueueService, ScanProcessor],
  exports: [ScansService],
})
export class ScansModule {}
