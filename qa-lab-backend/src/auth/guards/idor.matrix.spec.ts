import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IDOR_ROUTES } from '../../test-utils/idor-routes';
import { OrganizationsService } from '../../organizations/organizations.service';

/**
 * Cross-tenant authorization matrix (service-level).
 * Proves user A cannot access org B resources via requireMembership.
 */
describe('IDOR matrix — route catalog', () => {
  it('catalog lists authenticated resource routes', () => {
    const authed = IDOR_ROUTES.filter((r) => r.auth !== 'public');
    expect(authed.length).toBeGreaterThan(15);
    const resources = new Set(authed.map((r) => r.resource));
    expect(resources.has('Organization')).toBe(true);
    expect(resources.has('Project')).toBe(true);
    expect(resources.has('Website')).toBe(true);
    expect(resources.has('Scan')).toBe(true);
    expect(resources.has('ApiKey')).toBe(true);
  });
});

describe('IDOR matrix — membership boundary', () => {
  const prisma = {
    organizationMember: { findUnique: jest.fn() },
  };
  const service = new OrganizationsService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('user A is forbidden on org B', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    await expect(
      service.requireMembership('user-a', 'org-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('member of org A is allowed', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      organizationId: 'org-a',
      userId: 'user-a',
    });
    const m = await service.requireMembership('user-a', 'org-a');
    expect(m.role).toBe('OWNER');
  });
});

describe('IDOR matrix — website org isolation for API keys', () => {
  it('requireWebsiteInOrganization rejects foreign org', async () => {
    const { WebsitesService } = await import(
      '../../websites/websites.service'
    );
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'w1',
          project: { organizationId: 'org-b' },
        }),
      },
    };
    const service = new WebsitesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.requireWebsiteInOrganization('org-a', 'w1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requireWebsiteInOrganization allows same org', async () => {
    const { WebsitesService } = await import(
      '../../websites/websites.service'
    );
    const website = {
      id: 'w1',
      project: { organizationId: 'org-a' },
    };
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue(website),
      },
    };
    const service = new WebsitesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.requireWebsiteInOrganization('org-a', 'w1');
    expect(result.id).toBe('w1');
  });

  it('missing website is NotFound', async () => {
    const { WebsitesService } = await import(
      '../../websites/websites.service'
    );
    const prisma = {
      website: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new WebsitesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.requireWebsiteInOrganization('org-a', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
