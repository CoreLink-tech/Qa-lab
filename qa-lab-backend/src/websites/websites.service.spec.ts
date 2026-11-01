import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WebsitesService } from './websites.service';
import { OrganizationRole } from '../generated/prisma/client';

describe('WebsitesService', () => {
  let service: WebsitesService;
  let prisma: any;
  let projects: any;
  let organizations: any;
  let quotas: any;

  beforeEach(() => {
    prisma = {
      website: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    projects = {
      requireProjectAccess: jest.fn(),
    };
    organizations = {
      requireMembership: jest.fn(),
    };
    quotas = {
      assertCanAddWebsite: jest.fn(),
    };
    service = new WebsitesService(prisma, projects, organizations, quotas);
  });

  describe('requireWebsiteInOrganization', () => {
    it('rejects foreign org', async () => {
      prisma.website.findUnique.mockResolvedValue({
        id: 'w1',
        project: { organizationId: 'org-b' },
      });
      await expect(
        service.requireWebsiteInOrganization('org-a', 'w1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows same org', async () => {
      const website = { id: 'w1', project: { organizationId: 'org-a' } };
      prisma.website.findUnique.mockResolvedValue(website);
      const result = await service.requireWebsiteInOrganization('org-a', 'w1');
      expect(result.id).toBe('w1');
    });

    it('throws NotFound when missing', async () => {
      prisma.website.findUnique.mockResolvedValue(null);
      await expect(
        service.requireWebsiteInOrganization('org-a', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireWebsiteAccess', () => {
    it('throws NotFound when missing', async () => {
      prisma.website.findUnique.mockResolvedValue(null);
      await expect(
        service.requireWebsiteAccess('user-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('calls organizations.requireMembership for found website', async () => {
      prisma.website.findUnique.mockResolvedValue({
        id: 'w1',
        project: { organizationId: 'org-a' },
      });
      organizations.requireMembership.mockResolvedValue({ role: 'OWNER' });
      const result = await service.requireWebsiteAccess('user-1', 'w1');
      expect(result.id).toBe('w1');
      expect(organizations.requireMembership).toHaveBeenCalledWith(
        'user-1',
        'org-a',
        
      );
    });
  });
});
