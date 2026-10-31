import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrganizationRole } from '../generated/prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProjectsService } from '../projects/projects.service';
import { QuotasService } from '../quotas/quotas.service';
import { assertSafeExternalUrl } from '../common/security/assert-safe-url';
import { CreateWebsiteDto } from './dto/create-website.dto';
import { UpdateWebsiteDto } from './dto/update-website.dto';

@Injectable()
export class WebsitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(userId: string, dto: CreateWebsiteDto) {
    const project = await this.projects.requireProjectAccess(
      userId,
      dto.projectId,
    );

    await this.organizations.requireMembership(
      userId,
      project.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER],
    );

    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.quotas.assertCanAddWebsite(project.organizationId);
    const url = await assertSafeExternalUrl(dto.url.trim());

    try {
      const website = await this.prisma.website.create({
        data: {
          projectId: dto.projectId,
          name: dto.name.trim(),
          url,
        },
      });
      return this.toSummary(website);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'A website with this URL already exists in the project',
        );
      }
      throw error;
    }
  }

  async listByProject(userId: string, projectId: string) {
    await this.projects.requireProjectAccess(userId, projectId);

    const websites = await this.prisma.website.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    return websites.map((w) => this.toSummary(w));
  }

  async getOne(userId: string, websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        project: { select: { id: true, organizationId: true, name: true } },
        _count: { select: { scans: true } },
      },
    });

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    await this.organizations.requireMembership(
      userId,
      website.project.organizationId,
    );

    return {
      ...this.toSummary(website),
      project: website.project,
      scanCount: website._count.scans,
    };
  }

  async update(userId: string, websiteId: string, dto: UpdateWebsiteDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        project: { select: { organizationId: true } },
      },
    });

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    await this.organizations.requireMembership(
      userId,
      website.project.organizationId,
      [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.MEMBER],
    );

    try {
      const updated = await this.prisma.website.update({
        where: { id: websiteId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.url !== undefined
            ? { url: await assertSafeExternalUrl(dto.url.trim()) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      return this.toSummary(updated);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'A website with this URL already exists in the project',
        );
      }
      throw error;
    }
  }


  async requireWebsiteInOrganization(organizationId: string, websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { project: true },
    });
    if (!website) {
      throw new NotFoundException('Website not found');
    }
    if (website.project.organizationId !== organizationId) {
      throw new ForbiddenException('Website is outside API key organization');
    }
    return website;
  }

  async requireWebsiteAccess(userId: string, websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        project: true,
      },
    });
    if (!website) {
      throw new NotFoundException('Website not found');
    }
    await this.organizations.requireMembership(
      userId,
      website.project.organizationId,
    );
    return website;
  }

  private toSummary(website: {
    id: string;
    projectId: string;
    name: string;
    url: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: website.id,
      projectId: website.projectId,
      name: website.name,
      url: website.url,
      isActive: website.isActive,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
    };
  }
}
