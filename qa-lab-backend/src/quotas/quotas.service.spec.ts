import { HttpException } from '@nestjs/common';
import { QuotasService } from './quotas.service';

describe('QuotasService', () => {
  const prisma = {
    organization: { findUnique: jest.fn() },
    website: { count: jest.fn() },
    scan: { count: jest.fn() },
  };
  const service = new QuotasService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('blocks adding websites over limit', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'o1',
      planTier: 'free',
      maxWebsites: 2,
      maxPagesPerScan: 50,
      maxScansPerDay: 20,
      minScheduleIntervalHours: 24,
    });
    prisma.website.count.mockResolvedValue(2);
    await expect(service.assertCanAddWebsite('o1')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('blocks scans over daily limit', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'o1',
      planTier: 'free',
      maxWebsites: 5,
      maxPagesPerScan: 50,
      maxScansPerDay: 1,
      minScheduleIntervalHours: 24,
    });
    prisma.scan.count.mockResolvedValue(1);
    await expect(service.assertCanCreateScan('o1', 10)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('caps maxPages to plan limit', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'o1',
      planTier: 'free',
      maxWebsites: 5,
      maxPagesPerScan: 30,
      maxScansPerDay: 20,
      minScheduleIntervalHours: 24,
    });
    prisma.scan.count.mockResolvedValue(0);
    const r = await service.assertCanCreateScan('o1', 100);
    expect(r.maxPages).toBe(30);
  });
});
