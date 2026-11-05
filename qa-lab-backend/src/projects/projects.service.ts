import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { OrganizationRole } from '../generated/prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    await this.organizations.requireMembership(userId, dto.organizationId, [
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MEMBER,
    ]);

    const name = dto.name.trim();
    const baseSlug = dto.slug?.trim() || this.slugify(name);
    const slug = await this.uniqueSlug(dto.organizationId, baseSlug);

    const project = await this.prisma.project.create({
      data: {
        organizationId: dto.organizationId,
        name,
        slug,
        description: dto.description?.trim() || null,
      },
    });

    return this.toSummary(project);
  }

  async listByOrganization(userId: string, organizationId: string) {
    await this.organizations.requireMembership(userId, organizationId);

    const projects = await this.prisma.project.findMany({
      where: { organizationId },
      include: {
        _count: { select: { websites: true, scans: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => ({
      ...this.toSummary(p),
      websiteCount: p._count.websites,
      scanCount: p._count.scans,
    }));
  }

  async getOne(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: { select: { websites: true, scans: true } },
        websites: {
          select: {
            id: true,
            name: true,
            url: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.organizations.requireMembership(userId, project.organizationId);

    return {
      ...this.toSummary(project),
      websiteCount: project._count.websites,
      scanCount: project._count.scans,
      websites: project.websites,
    };
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.organizations.requireMembership(userId, project.organizationId, [
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MEMBER,
    ]);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
      },
    });

    return this.toSummary(updated);
  }

  async requireProjectAccess(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.organizations.requireMembership(userId, project.organizationId);
    return project;
  }

  private toSummary(project: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      slug: project.slug,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  /** Linear-time slugify (avoids polynomial regex on user input). */
  private slugify(input: string): string {
    const s = (input || '').toLowerCase().trim();
    const out: string[] = [];
    let prevDash = false;
    for (let i = 0; i < s.length && out.length < 60; i++) {
      const c = s.charCodeAt(i);
      const isAlnum =
        (c >= 97 && c <= 122) || // a-z
        (c >= 48 && c <= 57); // 0-9
      if (isAlnum) {
        out.push(s[i]);
        prevDash = false;
      } else if (!prevDash && out.length > 0) {
        out.push('-');
        prevDash = true;
      }
    }
    while (out.length && out[out.length - 1] === '-') out.pop();
    return out.join('') || 'project';
  }

  private async uniqueSlug(
    organizationId: string,
    base: string,
  ): Promise<string> {
    let candidate = base;
    let attempt = 0;
    while (attempt < 20) {
      const existing = await this.prisma.project.findUnique({
        where: {
          organizationId_slug: { organizationId, slug: candidate },
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      attempt += 1;
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
    }
    throw new ConflictException('Unable to allocate a unique project slug');
  }
}
