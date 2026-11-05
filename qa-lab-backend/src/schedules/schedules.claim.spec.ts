/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await -- unit mocks */
import { SchedulesService } from './schedules.service';

describe('SchedulesService concurrent claim', () => {
  it('claimOneDueSchedule returns at most one row per call (SKIP LOCKED contract)', async () => {
    const row = {
      id: 'sch-1',
      websiteId: 'w1',
      intervalHours: 24,
      options: {},
    };
    let calls = 0;
    const prisma = {
      $queryRaw: jest.fn().mockImplementation(async () => {
        calls += 1;
        // First caller wins; subsequent callers see empty (locked/claimed)
        return calls === 1 ? [row] : [];
      }),
    };

    const service = new SchedulesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const claim = (
      service as unknown as {
        claimOneDueSchedule: () => Promise<typeof row | null>;
      }
    ).claimOneDueSchedule.bind(service);

    const results = await Promise.all([
      claim(),
      claim(),
      claim(),
      claim(),
      claim(),
    ]);

    const hits = results.filter((r) => r !== null);
    expect(hits.length).toBe(1);
    expect(hits[0]?.id).toBe('sch-1');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});
