import { ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

describe('ProjectsService cross-tenant', () => {
  const prisma = {
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const organizations = {
    requireMembership: jest.fn(),
  };

  const service = new ProjectsService(
    prisma as never,
    organizations as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('listByOrganization checks membership first', async () => {
    organizations.requireMembership.mockRejectedValue(
      new ForbiddenException('Not a member'),
    );
    await expect(
      service.listByOrganization('user-a', 'org-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('requireProjectAccess denies when membership fails', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      organizationId: 'org-b',
    });
    organizations.requireMembership.mockRejectedValue(
      new ForbiddenException('Not a member'),
    );
    await expect(
      service.requireProjectAccess('user-a', 'p1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
