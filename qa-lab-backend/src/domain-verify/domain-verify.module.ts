import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DomainVerifyController } from './domain-verify.controller';
import { DomainVerifyService } from './domain-verify.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [DomainVerifyController],
  providers: [DomainVerifyService],
  exports: [DomainVerifyService],
})
export class DomainVerifyModule {}
