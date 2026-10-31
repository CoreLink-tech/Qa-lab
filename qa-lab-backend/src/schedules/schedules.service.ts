import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrganizationRole, ScanStatus, ScanTrigger } from '../generated/prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { WebsitesService } from '../websites/websites.service';
import { ScanQueueService } from '../queue/scan-queue.service';
import { AuditService } from '../audit/audit.service';
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

    const intervalHours = dto.intervalHours ?? 24;
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
          ? new Date(
              Date.now() + schedule.intervalHours * 60 * 60 * 1000,
            )
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
  async processDueSchedules(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.scanSchedule.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
      include: { website: true },
      take: 20,
    });

    let enqueued = 0;
    for (const schedule of due) {
      try {
        if (!schedule.website.isActive) continue;

        const options =
          (schedule.options as Record<string, unknown> | null) || {};

        const scan = await this.prisma.scan.create({
          data: {
            projectId: schedule.website.projectId,
            websiteId: schedule.websiteId,
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

        const nextRunAt = new Date(
          Date.now() + schedule.intervalHours * 60 * 60 * 1000,
        );
        await this.prisma.scanSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt },
        });

        enqueued += 1;
        this.logger.log(
          `Scheduled scan ${scan.id} for website ${schedule.websiteId}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to enqueue schedule ${schedule.id}: ${(err as Error).message}`,
        );
      }
    }

    return enqueued;
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
