import { ConfigService } from '@nestjs/config';
import { EmailNotifier } from './email-notifier.service.js';

const sendMailMock = vi.fn();

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
}));

function makeConfig(values: Record<string, unknown>): ConfigService {
  return { get: (key: string, fallback?: unknown) => values[key] ?? fallback } as ConfigService;
}

describe('EmailNotifier', () => {
  beforeEach(() => {
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue(undefined);
  });

  it('skips sending (without throwing) when SMTP is not configured', async () => {
    const notifier = new EmailNotifier(makeConfig({}));

    await notifier.send(
      { monitorName: 'example', monitorUrl: 'https://example.com', checkedAt: new Date() },
      'user@example.com',
    );

    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('sends an email with the failure details when SMTP is configured', async () => {
    const notifier = new EmailNotifier(
      makeConfig({ SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'alerts@pulse-infra.local' }),
    );
    const checkedAt = new Date('2026-01-01T00:00:00Z');

    await notifier.send(
      {
        monitorName: 'example',
        monitorUrl: 'https://example.com',
        statusCode: 503,
        error: 'HTTP 503',
        checkedAt,
      },
      'user@example.com',
    );

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'alerts@pulse-infra.local',
        to: 'user@example.com',
        subject: expect.stringContaining('example'),
        text: expect.stringContaining('503'),
      }),
    );
  });
});
