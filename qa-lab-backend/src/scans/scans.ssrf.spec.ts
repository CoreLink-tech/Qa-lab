/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- unit mocks */
import { BadRequestException } from '@nestjs/common';

jest.mock('../common/security/assert-safe-url', () => ({
  assertSafeExternalUrl: jest.fn(),
}));

import { assertSafeExternalUrl } from '../common/security/assert-safe-url';
import { ScansService } from './scans.service';

describe('ScansService SSRF at enqueue', () => {
  const assertSafe = assertSafeExternalUrl as jest.MockedFunction<
    typeof assertSafeExternalUrl
  >;

  beforeEach(() => {
    assertSafe.mockReset();
    assertSafe.mockResolvedValue('https://example.com');
  });

  function buildService(scanQueue: { enqueue: jest.Mock }) {
    const prisma = {
      scan: {
        create: jest.fn().mockResolvedValue({
          id: 's1',
          websiteId: 'w1',
          status: 'QUEUED',
        }),
        update: jest.fn(),
      },
    };
    return new ScansService(
      prisma as never,
      {} as never,
      {} as never,
      scanQueue as never,
      {} as never,
      {} as never,
    );
  }

  it('calls assertSafeExternalUrl with website URL before enqueue', async () => {
    const scanQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = buildService(scanQueue);

    await (
      service as unknown as {
        enqueueScan: (w: object, d: object, t: string) => Promise<object>;
      }
    ).enqueueScan(
      { id: 'w1', projectId: 'p1', url: 'https://example.com', isActive: true },
      {},
      'MANUAL',
    );

    expect(assertSafe).toHaveBeenCalledWith('https://example.com');
    expect(scanQueue.enqueue).toHaveBeenCalled();
  });

  it('does not enqueue when SSRF check fails', async () => {
    assertSafe.mockRejectedValue(new BadRequestException('Blocked'));
    const scanQueue = { enqueue: jest.fn() };
    const service = buildService(scanQueue);

    await expect(
      (
        service as unknown as {
          enqueueScan: (w: object, d: object, t: string) => Promise<object>;
        }
      ).enqueueScan(
        {
          id: 'w1',
          projectId: 'p1',
          url: 'http://127.0.0.1/',
          isActive: true,
        },
        {},
        'MANUAL',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(scanQueue.enqueue).not.toHaveBeenCalled();
  });
});
