import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  let service: RetentionService;
  let prisma: {
    report: { deleteMany: jest.Mock };
    auditLog: { deleteMany: jest.Mock };
    refreshToken: { deleteMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      report: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    service = new RetentionService(prisma as never);
  });

  it('run deletes old reports, audits and tokens', async () => {
    await service.run();
    expect(prisma.report.deleteMany).toHaveBeenCalled();
    expect(prisma.auditLog.deleteMany).toHaveBeenCalled();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
  });

  it('run swallows errors', async () => {
    prisma.report.deleteMany.mockRejectedValue(new Error('db down'));
    await expect(service.run()).resolves.toBeUndefined();
  });
});
