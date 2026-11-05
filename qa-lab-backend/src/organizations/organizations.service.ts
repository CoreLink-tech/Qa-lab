import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { OrganizationRole } from '../generated/prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const name = dto.name.trim();
    const baseSlug = dto.slug?.trim() || this.slugify(name);
    const slug = await this.uniqueSlug(baseSlug);

    const organization = await this.prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId,
            role: OrganizationRole.OWNER,
          },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: organization.members[0]?.role ?? OrganizationRole.OWNER,
      createdAt: organization.createdAt,
    };
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            _count: { select: { members: true, projects: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      memberCount: m.organization._count.members,
      projectCount: m.organization._count.projects,
      createdAt: m.organization.createdAt,
    }));
  }

  async getOne(userId: string, organizationId: string) {
    const membership = await this.requireMembership(userId, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: { select: { members: true, projects: true } },
        members: {
          select: {
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: membership.role,
      memberCount: organization._count.members,
      projectCount: organization._count.projects,
      members: organization.members.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }

  async update(
    userId: string,
    organizationId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.requireMembership(userId, organizationId, [
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
    ]);

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      },
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      updatedAt: organization.updatedAt,
    };
  }

  /**
   * Ensures the user is a member of the organization.
   * Optionally requires one of the given roles.
   */
  async requireMembership(
    userId: string,
    organizationId: string,
    roles?: OrganizationRole[],
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (roles && roles.length > 0 && !roles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of roles: ${roles.join(', ')}`,
      );
    }

    return membership;
  }

  async inviteMember(
    actorId: string,
    organizationId: string,
    email: string,
    role: OrganizationRole,
  ) {
    await this.requireMembership(actorId, organizationId, [
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
    ]);

    if (role === OrganizationRole.OWNER) {
      throw new ForbiddenException('Cannot assign OWNER via invite');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      throw new NotFoundException(
        'No user with that email. They must register first.',
      );
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
    });
    if (existing) {
      throw new ConflictException('User is already a member');
    }

    const membership = await this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role,
      },
    });

    return {
      userId: user.id,
      email: user.email,
      role: membership.role,
      organizationId,
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
    return out.join('') || 'organization';
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let attempt = 0;
    while (attempt < 20) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      attempt += 1;
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
    }
    // Extremely unlikely fallback
    throw new ConflictException(
      'Unable to allocate a unique organization slug',
    );
  }
}
