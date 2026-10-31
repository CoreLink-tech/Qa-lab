import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Organization plan quotas. Returns 429 / 402-style errors when exceeded.
 */
@Injectable()
export class QuotasService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrg(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new ForbiddenException('Organization not found');
    }
    return org;
  }

  async assertCanAddWebsite(organizationId: string): Promise<void> {
    const org = await this.getOrg(organizationId);
    const count = await this.prisma.website.count({
      where: { project: { organizationId } },
    });
    if (count >= org.maxWebsites) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `Website limit reached (${org.maxWebsites}) for plan ${org.planTier}`,
          code: 'QUOTA_WEBSITES',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  async assertCanCreateScan(
    organizationId: string,
    requestedMaxPages?: number,
  ): Promise<{ maxPages: number }> {
    const org = await this.getOrg(organizationId);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const scansToday = await this.prisma.scan.count({
      where: {
        website: { project: { organizationId } },
        createdAt: { gte: startOfDay },
      },
    });

    if (scansToday >= org.maxScansPerDay) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Daily scan limit reached (${org.maxScansPerDay}) for plan ${org.planTier}`,
          code: 'QUOTA_SCANS_PER_DAY',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const maxPages = Math.min(
      requestedMaxPages ?? org.maxPagesPerScan,
      org.maxPagesPerScan,
    );
    return { maxPages };
  }

  async assertScheduleInterval(
    organizationId: string,
    intervalHours: number,
  ): Promise<void> {
    const org = await this.getOrg(organizationId);
    if (intervalHours < org.minScheduleIntervalHours) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `Minimum schedule interval is ${org.minScheduleIntervalHours}h for plan ${org.planTier}`,
          code: 'QUOTA_SCHEDULE_INTERVAL',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
}
