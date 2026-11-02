import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { WebsitesModule } from '../websites/websites.module';
import { DomainVerifyModule } from '../domain-verify/domain-verify.module';
import { AuditModule } from '../audit/audit.module';
import { ScheduleTickerService } from './schedule-ticker.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [WebsitesModule, OrganizationsModule, DomainVerifyModule, AuditModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleTickerService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
