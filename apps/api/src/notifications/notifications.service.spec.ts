import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailNotifier } from './notifiers/email-notifier.service.js';
import { WebhookNotifier } from './notifiers/webhook-notifier.service.js';

const MONITOR = {
  id: 'monitor-1',
  userId: 'user-1',
  name: 'example',
  url: 'https://example.com',
  notifyEmail: true,
  notifyWebhookUrl: 'https://hooks.example.com/webhook',
};

const DOWN_CHECK = {
  status: 'DOWN' as const,
  statusCode: 500,
  error: 'HTTP 500',
  checkedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };
  let emailNotifier: { send: ReturnType<typeof vi.fn> };
  let webhookNotifier: { send: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = { user: { findUnique: vi.fn() } };
    emailNotifier = { send: vi.fn().mockResolvedValue(undefined) };
    webhookNotifier = { send: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailNotifier, useValue: emailNotifier },
        { provide: WebhookNotifier, useValue: webhookNotifier },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('does nothing when the check is UP', async () => {
    await service.notifyIfNewFailure(MONITOR, 'UP', { ...DOWN_CHECK, status: 'UP' });

    expect(emailNotifier.send).not.toHaveBeenCalled();
    expect(webhookNotifier.send).not.toHaveBeenCalled();
  });

  it('does nothing when the monitor was already down (no new transition)', async () => {
    await service.notifyIfNewFailure(MONITOR, 'DOWN', DOWN_CHECK);

    expect(emailNotifier.send).not.toHaveBeenCalled();
    expect(webhookNotifier.send).not.toHaveBeenCalled();
  });

  it('notifies on the first-ever check when it is already down', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    await service.notifyIfNewFailure(MONITOR, null, DOWN_CHECK);

    expect(emailNotifier.send).toHaveBeenCalledWith(expect.anything(), 'user@example.com');
    expect(webhookNotifier.send).toHaveBeenCalledWith(
      expect.anything(),
      'https://hooks.example.com/webhook',
    );
  });

  it('notifies on an UP -> DOWN transition via both enabled channels', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    await service.notifyIfNewFailure(MONITOR, 'UP', DOWN_CHECK);

    expect(emailNotifier.send).toHaveBeenCalledTimes(1);
    expect(webhookNotifier.send).toHaveBeenCalledTimes(1);
  });

  it('skips the email channel when notifyEmail is false', async () => {
    await service.notifyIfNewFailure({ ...MONITOR, notifyEmail: false }, 'UP', DOWN_CHECK);

    expect(emailNotifier.send).not.toHaveBeenCalled();
    expect(webhookNotifier.send).toHaveBeenCalledTimes(1);
  });

  it('skips the webhook channel when no webhook URL is set', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    await service.notifyIfNewFailure({ ...MONITOR, notifyWebhookUrl: null }, 'UP', DOWN_CHECK);

    expect(emailNotifier.send).toHaveBeenCalledTimes(1);
    expect(webhookNotifier.send).not.toHaveBeenCalled();
  });

  it("isolates one channel's failure from the other", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    emailNotifier.send.mockRejectedValue(new Error('smtp exploded'));

    await expect(service.notifyIfNewFailure(MONITOR, 'UP', DOWN_CHECK)).resolves.not.toThrow();
    expect(webhookNotifier.send).toHaveBeenCalledTimes(1);
  });
});
