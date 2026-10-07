import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { FailureNotification, Notifier } from '../notifier.interface.js';

@Injectable()
export class EmailNotifier implements Notifier {
  private readonly logger = new Logger(EmailNotifier.name);
  private readonly from: string;
  private readonly transporter: Transporter | null;

  constructor(config: ConfigService) {
    this.from = config.get<string>('SMTP_FROM', 'alerts@pulse-infra.local');

    const host = config.get<string>('SMTP_HOST');
    if (!host) {
      // No-op rather than throw: lets the app (and its tests) run locally
      // without real SMTP credentials. Attempts to send are logged instead.
      this.transporter = null;
      return;
    }

    this.transporter = createTransport({
      host,
      port: config.get<number>('SMTP_PORT', 587),
      secure: config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: config.get<string>('SMTP_USER', ''),
        pass: config.get<string>('SMTP_PASS', ''),
      },
    });
  }

  async send(notification: FailureNotification, target: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`SMTP not configured — skipping email alert to ${target}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: target,
      subject: `[pulse-infra] ${notification.monitorName} is down`,
      text: [
        `${notification.monitorName} (${notification.monitorUrl}) failed a check at ${notification.checkedAt.toISOString()}.`,
        notification.statusCode ? `Status code: ${notification.statusCode}` : undefined,
        notification.error ? `Error: ${notification.error}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }
}
