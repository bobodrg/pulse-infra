import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChecksService } from './checks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MonitorsService } from '../monitors/monitors.service.js';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const MONITOR_ID = '11111111-1111-4111-8111-111111111111';

describe('ChecksService', () => {
  let service: ChecksService;
  let prisma: {
    check: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let monitorsService: { findOneForUser: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = { check: { findMany: vi.fn(), count: vi.fn() } };
    monitorsService = { findOneForUser: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecksService,
        { provide: PrismaService, useValue: prisma },
        { provide: MonitorsService, useValue: monitorsService },
      ],
    }).compile();

    service = module.get<ChecksService>(ChecksService);
  });

  it('rejects when the monitor does not belong to the caller', async () => {
    monitorsService.findOneForUser.mockRejectedValue(new NotFoundException());

    await expect(service.findForMonitor(USER_ID, MONITOR_ID, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.check.findMany).not.toHaveBeenCalled();
  });

  it('paginates checks for an owned monitor, newest first', async () => {
    monitorsService.findOneForUser.mockResolvedValue({ id: MONITOR_ID, userId: USER_ID });
    prisma.check.findMany.mockResolvedValue([]);
    prisma.check.count.mockResolvedValue(0);

    await service.findForMonitor(USER_ID, MONITOR_ID, { limit: 10, offset: 5 });

    expect(prisma.check.findMany).toHaveBeenCalledWith({
      where: { monitorId: MONITOR_ID },
      orderBy: { checkedAt: 'desc' },
      take: 10,
      skip: 5,
    });
  });

  it('defaults to limit 50 and offset 0', async () => {
    monitorsService.findOneForUser.mockResolvedValue({ id: MONITOR_ID, userId: USER_ID });
    prisma.check.findMany.mockResolvedValue([]);
    prisma.check.count.mockResolvedValue(0);

    const result = await service.findForMonitor(USER_ID, MONITOR_ID, {});

    expect(prisma.check.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 }),
    );
    expect(result).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
  });
});
