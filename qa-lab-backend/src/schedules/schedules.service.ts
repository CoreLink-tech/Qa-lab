import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  OrganizationRole,
  ScanStatus,
  ScanTrigger,
} from '../generated/prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { WebsitesService } from '../websites/websites.service';
import { ScanQueueService } from '../queue/scan-queue.service';
import { AuditService } from '../audit/audit.service';
import { QuotasService } from '../quotas/quotas.service';
import { DomainVerifyService } from '../domain-verify/domain-verify.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websites: WebsitesService,
    private readonly organizations: OrganizationsService,
    private readonly scanQueue: ScanQueueService,
    private readonly audit: AuditService,
    private readonly quotas: QuotasService,
    private readonly domainVerify: DomainVerifyService,
  ) {}

  async create(userId: string, dto: CreateScheduleDto) {
    const website = await this.websites.requireWebsiteAccess(
      userId,
      dto.websiteId,
    );

    await this.organizations.requireMembership(
      userId,
      website.project.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER],
    );

    await this.domainVerify.assertVerified(dto.websiteId);

    const intervalHours = dto.intervalHours ?? 24;
    await this.quotas.assertScheduleInterval(
      website.project.organizationId,
      intervalHours,
    );
    const options = {
      maxPages: dto.maxPages ?? 50,
      maxDepth: dto.maxDepth ?? 2,
    };

    const nextRunAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);

    const schedule = await this.prisma.scanSchedule.create({
      data: {
        websiteId: dto.websiteId,
        intervalHours,
        enabled: dto.enabled ?? true,
        options,
        nextRunAt,
      },
    });

    await this.audit.log({
      organizationId: website.project.organizationId,
      userId,
      action: 'schedule.create',
      resource: 'ScanSchedule',
      resourceId: schedule.id,
      metadata: { intervalHours, websiteId: dto.websiteId },
    });

    return this.toSummary(schedule);
  }

  async listByWebsite(userId: string, websiteId: string) {
    await this.websites.requireWebsiteAccess(userId, websiteId);
    const rows = await this.prisma.scanSchedule.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toSummary(r));
  }

  async setEnabled(userId: string, scheduleId: string, enabled: boolean) {
    const schedule = await this.prisma.scanSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        website: { include: { project: true } },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    await this.organizations.requireMembership(
      userId,
      schedule.website.project.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER],
    );

    const updated = await this.prisma.scanSchedule.update({
      where: { id: scheduleId },
      data: {
        enabled,
        nextRunAt: enabled
          ? new Date(Date.now() + schedule.intervalHours * 60 * 60 * 1000)
          : null,
      },
    });

    return this.toSummary(updated);
  }

  async remove(userId: string, scheduleId: string) {
    const schedule = await this.prisma.scanSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        website: { include: { project: true } },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    await this.organizations.requireMembership(
      userId,
      schedule.website.project.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN],
    );

    await this.prisma.scanSchedule.delete({ where: { id: scheduleId } });
    return { id: scheduleId, deleted: true };
  }

  /**
   * Called periodically by ScheduleTicker — enqueues due scheduled scans.
   */

  /**
   * Atomically claim due schedules (FOR UPDATE SKIP LOCKED) and enqueue scans.
   * Safe under multiple worker/API instances.
   */
  async processDueSchedules(): Promise<number> {
    let enqueued = 0;
    for (let i = 0; i < 20; i++) {
      const claimed = await this.claimOneDueSchedule();
      if (!claimed) break;

      try {
        const website = await this.prisma.website.findUnique({
          where: { id: claimed.websiteId },
          include: { project: true },
        });
        if (!website || !website.isActive || !website.domainVerifiedAt) {
          continue;
        }

        try {
          await this.quotas.assertCanCreateScan(
            website.project.organizationId,
            (claimed.options as { maxPages?: number } | null)?.maxPages,
          );
        } catch {
          this.logger.warn(
            `Quota blocked scheduled scan for org ${website.project.organizationId}`,
          );
          continue;
        }

        const options =
          (claimed.options as Record<string, unknown> | null) || {};

        const scan = await this.prisma.scan.create({
          data: {
            projectId: website.projectId,
            websiteId: website.id,
            status: ScanStatus.QUEUED,
            trigger: ScanTrigger.SCHEDULED,
            options: {
              maxPages: options.maxPages ?? 50,
              maxDepth: options.maxDepth ?? 2,
              concurrency: 5,
              respectRobotsTxt: true,
              checkExposedPaths: false,
              checkAssets: false,
            },
          },
        });

        await this.scanQueue.enqueue({ scanId: scan.id });
        enqueued += 1;
        this.logger.log(
          `Scheduled scan ${scan.id} for website ${claimed.websiteId}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed schedule ${claimed.id}: ${(err as Error).message}`,
        );
      }
    }
    return enqueued;
  }

  /**
   * Claim a single due row by advancing nextRunAt under row lock.
   */
  private async claimOneDueSchedule(): Promise<{
    id: string;
    websiteId: string;
    intervalHours: number;
    options: unknown;
  } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        websiteId: string;
        intervalHours: number;
        options: unknown;
      }>
    >`
      UPDATE "ScanSchedule" AS s
      SET
        "lastRunAt" = NOW(),
        "nextRunAt" = NOW() + make_interval(hours => s."intervalHours"),
        "updatedAt" = NOW()
      WHERE s.id = (
        SELECT id FROM "ScanSchedule"
        WHERE enabled = true
          AND "nextRunAt" IS NOT NULL
          AND "nextRunAt" <= NOW()
        ORDER BY "nextRunAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING s.id, s."websiteId", s."intervalHours", s.options
    `;
    return rows[0] || null;
  }

  private toSummary(schedule: {
    id: string;
    websiteId: string;
    intervalHours: number;
    enabled: boolean;
    options: unknown;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: schedule.id,
      websiteId: schedule.websiteId,
      intervalHours: schedule.intervalHours,
      enabled: schedule.enabled,
      options: schedule.options,
      lastRunAt: schedule.lastRunAt,
      nextRunAt: schedule.nextRunAt,
      createdAt: schedule.createdAt,
    };
  }
}
