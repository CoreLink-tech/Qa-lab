import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { WebsitesModule } from '../websites/websites.module';
import { ScanProcessor } from './scan.processor';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

@Module({
  imports: [WebsitesModule, OrganizationsModule, AuthModule, ApiKeysModule],
  controllers: [ScansController],
  providers: [ScansService, ScanProcessor],
  exports: [ScansService],
})
export class ScansModule {}
