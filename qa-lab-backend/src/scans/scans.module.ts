import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { WebsitesModule } from '../websites/websites.module';
import { ScanProcessor } from './scan.processor';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

@Module({
  imports: [WebsitesModule, OrganizationsModule],
  controllers: [ScansController],
  providers: [ScansService, ScanProcessor],
  exports: [ScansService],
})
export class ScansModule {}
