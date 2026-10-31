import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ScanStatus, ScanTrigger } from '../generated/prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { SCAN_QUEUE_NAME, type ScanJobPayload } from '../queue/queue.constants';
import { ScanQueueService } from '../queue/scan-queue.service';
import { WebsitesService } from '../websites/websites.service';
import { QuotasService } from '../quotas/quotas.service';
import { DomainVerifyService } from '../domain-verify/domain-verify.service';
import { CreateScanDto } from './dto/create-scan.dto';

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websites: WebsitesService,
    private readonly organizations: OrganizationsService,
    private readonly scanQueue: ScanQueueService,
    private readonly quotas: QuotasService,
    private readonly domainVerify: DomainVerifyService,
  ) {}


  /**
   * Create scan for either a user session or an API key principal.
   */
  async createForPrincipal(
    principal: {
      kind?: string;
      id: string;
      userId?: string | null;
      organizationId?: string;
    },
    dto: CreateScanDto,
  ) {
    if (principal.kind === 'api_key' && principal.organizationId) {
      const website = await this.websites.requireWebsiteInOrganization(
        principal.organizationId,
        dto.websiteId,
      );
      if (!website.isActive) {
        throw new BadRequestException('Website is inactive');
      }
      return this.enqueueScan(website, dto, ScanTrigger.API);
    }
    const userId = principal.userId || principal.id;
    return this.create(userId, dto);
  }

  private async enqueueScan(
    website: { id: string; projectId: string; url: string; isActive: boolean },
    dto: CreateScanDto,
    trigger: typeof ScanTrigger.API | typeof ScanTrigger.MANUAL,
  ) {
    const options = {
      maxPages: dto.maxPages ?? 50,
      maxDepth: dto.maxDepth ?? 2,
      concurrency: dto.concurrency ?? 5,
      respectRobotsTxt: dto.respectRobotsTxt ?? true,
      checkExposedPaths: dto.checkExposedPaths ?? false,
      checkAssets: dto.checkAssets ?? false,
    };

    const scan = await this.prisma.scan.create({
      data: {
        projectId: website.projectId,
        websiteId: website.id,
        status: ScanStatus.QUEUED,
        trigger,
        options,
      },
    });

    try {
      await this.scanQueue.enqueue({ scanId: scan.id });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue scan ${scan.id}: ${(error as Error).message}`,
      );
      await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: ScanStatus.FAILED,
          error: 'Failed to enqueue scan job',
          completedAt: new Date(),
        },
      });
      throw error;
    }

    this.logger.log(`Scan ${scan.id} queued for website ${website.url}`);
    return {
      id: scan.id,
      websiteId: scan.websiteId,
      projectId: scan.projectId,
      status: scan.status,
      trigger: scan.trigger,
      options: scan.options,
      queuedAt: scan.queuedAt,
    };
  }

  async create(userId: string, dto: CreateScanDto) {
    const website = await this.websites.requireWebsiteAccess(
      userId,
      dto.websiteId,
    );

    if (!website.isActive) {
      throw new BadRequestException('Website is inactive');
    }

    const orgId = website.project.organizationId;
    const { maxPages: allowedPages } = await this.quotas.assertCanCreateScan(
      orgId,
      dto.maxPages,
    );

    if (dto.checkExposedPaths) {
      await this.domainVerify.assertVerified(website.id);
    }

    const options = {
      maxPages: allowedPages,
      maxDepth: dto.maxDepth ?? 2,
      concurrency: dto.concurrency ?? 5,
      respectRobotsTxt: dto.respectRobotsTxt ?? true,
      checkExposedPaths: dto.checkExposedPaths ?? false,
      checkAssets: dto.checkAssets ?? false,
    };

    const scan = await this.prisma.scan.create({
      data: {
        projectId: website.projectId,
        websiteId: website.id,
        status: ScanStatus.QUEUED,
        trigger: ScanTrigger.MANUAL,
        options,
      },
    });

    const payload: ScanJobPayload = { scanId: scan.id };

    try {
      await this.scanQueue.enqueue(payload);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue scan ${scan.id}: ${(error as Error).message}`,
      );
      await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: ScanStatus.FAILED,
          error: 'Failed to enqueue scan job',
          completedAt: new Date(),
        },
      });
      throw error;
    }

    this.logger.log(`Scan ${scan.id} queued for website ${website.url}`);

    return {
      id: scan.id,
      websiteId: scan.websiteId,
      projectId: scan.projectId,
      status: scan.status,
      trigger: scan.trigger,
      options: scan.options,
      queuedAt: scan.queuedAt,
    };
  }


  async listByWebsiteForPrincipal(
    principal: { kind?: string; id: string; userId?: string | null; organizationId?: string },
    websiteId: string,
  ) {
    if (principal.kind === 'api_key' && principal.organizationId) {
      await this.websites.requireWebsiteInOrganization(
        principal.organizationId,
        websiteId,
      );
      return this.listByWebsiteInternal(websiteId);
    }
    return this.listByWebsite(principal.userId || principal.id, websiteId);
  }

  async getByIdForPrincipal(
    principal: { kind?: string; id: string; userId?: string | null; organizationId?: string },
    scanId: string,
  ) {
    if (principal.kind === 'api_key' && principal.organizationId) {
      const scan = await this.prisma.scan.findUnique({
        where: { id: scanId },
        include: {
          website: { include: { project: true } },
          report: true,
        },
      });
      if (!scan) throw new NotFoundException('Scan not found');
      if (scan.website.project.organizationId !== principal.organizationId) {
        throw new NotFoundException('Scan not found');
      }
      return this.getById(scan.website.projectId ? (principal.userId || 'api') : 'api', scanId).catch(async () => {
        // Fallback shape without user membership
        return {
          id: scan.id,
          websiteId: scan.websiteId,
          projectId: scan.projectId,
          status: scan.status,
          trigger: scan.trigger,
          options: scan.options,
          pagesScanned: scan.pagesScanned,
          error: scan.error,
          queuedAt: scan.queuedAt,
          startedAt: scan.startedAt,
          completedAt: scan.completedAt,
          website: {
            id: scan.website.id,
            name: scan.website.name,
            url: scan.website.url,
          },
          report: scan.report,
        };
      });
    }
    return this.getById(principal.userId || principal.id, scanId);
  }

  private async listByWebsiteInternal(websiteId: string) {
    const scans = await this.prisma.scan.findMany({
      where: { websiteId },
      include: {
        report: {
          select: { score: true, grade: true, issueCount: true },
        },
        website: { select: { id: true, name: true, url: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return scans.map((s) => ({
      id: s.id,
      websiteId: s.websiteId,
      projectId: s.projectId,
      status: s.status,
      trigger: s.trigger,
      pagesScanned: s.pagesScanned,
      score: s.report?.score ?? null,
      grade: s.report?.grade ?? null,
      issueCount: s.report?.issueCount ?? null,
      queuedAt: s.queuedAt,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      website: s.website,
    }));
  }

  async listByWebsite(userId: string, websiteId: string) {
    await this.websites.requireWebsiteAccess(userId, websiteId);

    const scans = await this.prisma.scan.findMany({
      where: { websiteId },
      include: {
        report: {
          select: {
            score: true,
            grade: true,
            issueCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return scans.map((s) => this.toSummary(s));
  }

  async listByProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.organizations.requireMembership(
      userId,
      project.organizationId,
    );

    const scans = await this.prisma.scan.findMany({
      where: { projectId },
      include: {
        report: {
          select: { score: true, grade: true, issueCount: true },
        },
        website: {
          select: { id: true, name: true, url: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return scans.map((s) => ({
      ...this.toSummary(s),
      website: s.website,
    }));
  }

  async getOne(userId: string, scanId: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        report: true,
        website: {
          select: { id: true, name: true, url: true, projectId: true },
        },
        project: {
          select: { id: true, name: true, organizationId: true },
        },
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    await this.organizations.requireMembership(
      userId,
      scan.project.organizationId,
    );

    return {
      id: scan.id,
      status: scan.status,
      trigger: scan.trigger,
      options: scan.options,
      pagesScanned: scan.pagesScanned,
      error: scan.error,
      queuedAt: scan.queuedAt,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      website: scan.website,
      project: {
        id: scan.project.id,
        name: scan.project.name,
      },
      report: scan.report
        ? {
            id: scan.report.id,
            score: scan.report.score,
            grade: scan.report.grade,
            issueCount: scan.report.issueCount,
            // Full JSON available; large payloads — callers can request detail later
            reportJson: scan.report.reportJson,
            reportHtml: scan.report.reportHtml,
            createdAt: scan.report.createdAt,
          }
        : null,
      createdAt: scan.createdAt,
    };
  }

  async cancel(userId: string, scanId: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        project: { select: { organizationId: true } },
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    await this.organizations.requireMembership(
      userId,
      scan.project.organizationId,
    );

    if (
      scan.status !== ScanStatus.QUEUED &&
      scan.status !== ScanStatus.RUNNING
    ) {
      throw new BadRequestException(
        `Cannot cancel scan in status ${scan.status}`,
      );
    }

    // Best-effort: remove from queue if still waiting
    await this.scanQueue.removeJob(scanId).catch(() => undefined);

    const updated = await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        status: ScanStatus.CANCELLED,
        completedAt: new Date(),
        error: 'Cancelled by user',
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt,
    };
  }

  private toSummary(scan: {
    id: string;
    websiteId: string;
    projectId: string;
    status: ScanStatus;
    trigger: ScanTrigger;
    pagesScanned: number | null;
    queuedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    report?: {
      score: number | null;
      grade: string | null;
      issueCount: number;
    } | null;
  }) {
    return {
      id: scan.id,
      websiteId: scan.websiteId,
      projectId: scan.projectId,
      status: scan.status,
      trigger: scan.trigger,
      pagesScanned: scan.pagesScanned,
      queuedAt: scan.queuedAt,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      createdAt: scan.createdAt,
      score: scan.report?.score ?? null,
      grade: scan.report?.grade ?? null,
      issueCount: scan.report?.issueCount ?? null,
    };
  }
}
