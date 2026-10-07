import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PingerService } from './pinger.service.js';
import { MonitorCheckerService } from './monitor-checker.service.js';
import { MonitorsService } from '../monitors/monitors.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PingerService', () => {
  let service: PingerService;
  let monitorsService: {
    findDueForCheck: ReturnType<typeof vi.fn>;
    markChecked: ReturnType<typeof vi.fn>;
  };
  let monitorChecker: { check: ReturnType<typeof vi.fn> };
  let prisma: { check: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> } };
  let notificationsService: { notifyIfNewFailure: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    monitorsService = { findDueForCheck: vi.fn(), markChecked: vi.fn() };
    monitorChecker = { check: vi.fn() };
    prisma = { check: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) } };
    notificationsService = { notifyIfNewFailure: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PingerService,
        { provide: MonitorsService, useValue: monitorsService },
        { provide: MonitorCheckerService, useValue: monitorChecker },
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: SchedulerRegistry,
          useValue: { addInterval: vi.fn(), deleteInterval: vi.fn(), doesExist: vi.fn() },
        },
        { provide: ConfigService, useValue: { get: (_key: string, fallback: unknown) => fallback } },
      ],
    }).compile();

    service = module.get<PingerService>(PingerService);
  });

  it('does nothing when no monitors are due', async () => {
    monitorsService.findDueForCheck.mockResolvedValue([]);

    await service.tick();

    expect(monitorChecker.check).not.toHaveBeenCalled();
    expect(prisma.check.create).not.toHaveBeenCalled();
  });

  it('checks each due monitor, records a Check row, and updates lastCheckedAt', async () => {
    monitorsService.findDueForCheck.mockResolvedValue([
      { id: 'monitor-1', url: 'https://example.com' },
    ]);
    monitorChecker.check.mockResolvedValue({ status: 'UP', statusCode: 200, responseTimeMs: 42 });

    await service.tick();

    expect(monitorChecker.check).toHaveBeenCalledWith('https://example.com', 10_000);
    expect(prisma.check.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        monitorId: 'monitor-1',
        status: 'UP',
        statusCode: 200,
        responseTimeMs: 42,
      }),
    });
    expect(monitorsService.markChecked).toHaveBeenCalledWith('monitor-1', expect.any(Date));
  });

  it("isolates one monitor's failure from the others in the same tick", async () => {
    monitorsService.findDueForCheck.mockResolvedValue([
      { id: 'monitor-1', url: 'https://a.example' },
      { id: 'monitor-2', url: 'https://b.example' },
    ]);
    monitorChecker.check.mockImplementation((url: string) => {
      if (url === 'https://a.example') {
        return Promise.reject(new Error('boom'));
      }
      return Promise.resolve({ status: 'UP', statusCode: 200, responseTimeMs: 10 });
    });

    await service.tick();

    expect(monitorsService.markChecked).toHaveBeenCalledTimes(1);
    expect(monitorsService.markChecked).toHaveBeenCalledWith('monitor-2', expect.any(Date));
  });

  it('passes the previous check status and new check to NotificationsService', async () => {
    monitorsService.findDueForCheck.mockResolvedValue([
      {
        id: 'monitor-1',
        url: 'https://example.com',
        name: 'example',
        userId: 'user-1',
        notifyEmail: true,
        notifyWebhookUrl: null,
      },
    ]);
    prisma.check.findFirst.mockResolvedValue({ status: 'UP' });
    monitorChecker.check.mockResolvedValue({ status: 'DOWN', statusCode: 500, responseTimeMs: 5 });
    const createdCheck = { id: 'check-1', status: 'DOWN', statusCode: 500 };
    prisma.check.create.mockResolvedValue(createdCheck);

    await service.tick();

    expect(notificationsService.notifyIfNewFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'monitor-1' }),
      'UP',
      createdCheck,
    );
  });

  it('skips a tick that starts while the previous one is still running', async () => {
    let resolveFirstCheck!: () => void;
    monitorsService.findDueForCheck.mockResolvedValue([
      { id: 'monitor-1', url: 'https://example.com' },
    ]);
    monitorChecker.check.mockReturnValue(
      new Promise((resolve) => {
        resolveFirstCheck = () => resolve({ status: 'UP', statusCode: 200, responseTimeMs: 1 });
      }),
    );

    const firstTick = service.tick();
    const secondTick = service.tick();

    expect(monitorsService.findDueForCheck).toHaveBeenCalledTimes(1);

    resolveFirstCheck();
    await Promise.all([firstTick, secondTick]);
  });
});
