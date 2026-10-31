import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { OrganizationRole } from '../generated/prisma/client';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: {
    organization: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    organizationMember: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      organizationMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(OrganizationsService);
  });

  describe('create', () => {
    it('creates an organization and assigns OWNER role', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
        createdAt: new Date(),
        members: [{ role: OrganizationRole.OWNER }],
      });

      const result = await service.create('user-1', { name: 'Acme' });
      expect(result.role).toBe(OrganizationRole.OWNER);
      expect(result.slug).toBe('acme');
      expect(prisma.organization.create).toHaveBeenCalled();
    });
  });

  describe('requireMembership', () => {
    it('throws when user is not a member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(
        service.requireMembership('user-1', 'org-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when role is insufficient', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        role: OrganizationRole.VIEWER,
      });
      await expect(
        service.requireMembership('user-1', 'org-1', [
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
        ]),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns membership when role is allowed', async () => {
      const membership = { role: OrganizationRole.ADMIN };
      prisma.organizationMember.findUnique.mockResolvedValue(membership);
      await expect(
        service.requireMembership('user-1', 'org-1', [
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
        ]),
      ).resolves.toEqual(membership);
    });
  });

  describe('getOne', () => {
    it('throws NotFound when organization row is missing', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        role: OrganizationRole.MEMBER,
      });
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.getOne('user-1', 'org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
