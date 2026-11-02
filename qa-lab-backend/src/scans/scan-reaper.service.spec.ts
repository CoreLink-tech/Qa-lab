/* eslint-disable @typescript-eslint/no-unsafe-member-access -- unit test mocks */
import { ScanReaperService } from './scan-reaper.service';
import { ScanStatus } from '../generated/prisma/client';

describe('ScanReaperService', () => {
  let service: ScanReaperService;
  let prisma: { scan: { updateMany: jest.Mock } };

  beforeEach(() => {
    prisma = {
      scan: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    service = new ScanReaperService(prisma as never);
  });

  it('reap updates stuck RUNNING scans', async () => {
    prisma.scan.updateMany.mockResolvedValue({ count: 2 });
    // access private via any for test
    await (service as unknown as { reap: () => Promise<void> }).reap();
    expect(prisma.scan.updateMany).toHaveBeenCalled();
    const arg = prisma.scan.updateMany.mock.calls[0][0] as {
      where: { status: string };
      data: { status: string };
    };
    expect(arg.where.status).toBe(ScanStatus.RUNNING);
    expect(arg.data.status).toBe(ScanStatus.FAILED);
  });

  it('reap swallows errors', async () => {
    prisma.scan.updateMany.mockRejectedValue(new Error('db'));
    await expect(
      (service as unknown as { reap: () => Promise<void> }).reap(),
    ).resolves.toBeUndefined();
  });
});
