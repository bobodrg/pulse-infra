import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MonitorsService } from './monitors.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';
const MONITOR_ID = '11111111-1111-4111-8111-111111111111';

describe('MonitorsService', () => {
  let service: MonitorsService;
  let prisma: {
    monitor: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      monitor: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MonitorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<MonitorsService>(MonitorsService);
  });

  it('creates a monitor scoped to the given user', async () => {
    const dto = { name: 'example', url: 'https://example.com' };
    prisma.monitor.create.mockResolvedValue({ id: MONITOR_ID, userId: USER_ID, ...dto });

    await service.create(USER_ID, dto);

    expect(prisma.monitor.create).toHaveBeenCalledWith({
      data: { ...dto, userId: USER_ID },
    });
  });

  it('lists only the given user\'s monitors', async () => {
    prisma.monitor.findMany.mockResolvedValue([]);

    await service.findAllForUser(USER_ID);

    expect(prisma.monitor.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('throws NotFoundException when a monitor does not belong to the user', async () => {
    prisma.monitor.findFirst.mockResolvedValue(null);

    await expect(service.findOneForUser(OTHER_USER_ID, MONITOR_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a monitor after confirming ownership', async () => {
    prisma.monitor.findFirst.mockResolvedValue({ id: MONITOR_ID, userId: USER_ID });
    prisma.monitor.update.mockResolvedValue({ id: MONITOR_ID, userId: USER_ID, name: 'renamed' });

    await service.update(USER_ID, MONITOR_ID, { name: 'renamed' });

    expect(prisma.monitor.update).toHaveBeenCalledWith({
      where: { id: MONITOR_ID },
      data: { name: 'renamed' },
    });
  });

  it('refuses to update a monitor owned by another user', async () => {
    prisma.monitor.findFirst.mockResolvedValue(null);

    await expect(
      service.update(OTHER_USER_ID, MONITOR_ID, { name: 'renamed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.monitor.update).not.toHaveBeenCalled();
  });

  it('deletes a monitor after confirming ownership', async () => {
    prisma.monitor.findFirst.mockResolvedValue({ id: MONITOR_ID, userId: USER_ID });
    prisma.monitor.delete.mockResolvedValue({ id: MONITOR_ID });

    await service.remove(USER_ID, MONITOR_ID);

    expect(prisma.monitor.delete).toHaveBeenCalledWith({ where: { id: MONITOR_ID } });
  });
});
