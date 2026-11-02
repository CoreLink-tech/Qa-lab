import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WebsitesService } from './websites.service';

describe('WebsitesService', () => {
  let service: WebsitesService;
  let prisma: {
    website: {
      findUnique: jest.Mock;
    };
  };
  let projects: Record<string, jest.Mock>;
  let organizations: { requireMembership: jest.Mock };
  let quotas: Record<string, jest.Mock>;

  beforeEach(() => {
    prisma = {
      website: {
        findUnique: jest.fn(),
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
    service = new WebsitesService(
      prisma as never,
      projects as never,
      organizations as never,
      quotas as never,
    );
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
