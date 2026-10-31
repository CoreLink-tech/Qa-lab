import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { WebsitesModule } from '../websites/websites.module';
import { DomainVerifyModule } from '../domain-verify/domain-verify.module';
import { OrgConcurrencyLimiter } from './org-concurrency.limiter';
import { ScanProcessor } from './scan.processor';
import { ScanReaperService } from './scan-reaper.service';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

@Module({
  imports: [
    WebsitesModule,
    OrganizationsModule,
    AuthModule,
    ApiKeysModule,
    DomainVerifyModule,
  ],
  controllers: [ScansController],
  providers: [
    ScansService,
    OrgConcurrencyLimiter,
    ScanProcessor,
    ScanReaperService,
  ],
  exports: [ScansService],
})
export class ScansModule {}
