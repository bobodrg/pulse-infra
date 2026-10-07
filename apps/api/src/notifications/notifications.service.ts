import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CheckStatus } from '../../generated/prisma/client.js';
import { EmailNotifier } from './notifiers/email-notifier.service.js';
import { WebhookNotifier } from './notifiers/webhook-notifier.service.js';
import { FailureNotification } from './notifier.interface.js';

export interface NotifiableMonitor {
  id: string;
  userId: string;
  name: string;
  url: string;
  notifyEmail: boolean;
  notifyWebhookUrl: string | null;
}

export interface NotifiableCheck {
  status: CheckStatus;
  statusCode: number | null;
  error: string | null;
  checkedAt: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailNotifier: EmailNotifier,
    private readonly webhookNotifier: WebhookNotifier,
  ) {}

  /**
   * Alerts only on the UP -> DOWN transition (or a first-ever check that's
   * already down), not on every failed check while a monitor stays down —
   * otherwise a monitor down for hours would spam every notification
   * channel once per tick.
   */
  async notifyIfNewFailure(
    monitor: NotifiableMonitor,
    previousStatus: CheckStatus | null,
    check: NotifiableCheck,
  ): Promise<void> {
    const isNewFailure = check.status === 'DOWN' && previousStatus !== 'DOWN';
    if (!isNewFailure) {
      return;
    }

    const notification: FailureNotification = {
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      statusCode: check.statusCode ?? undefined,
      error: check.error ?? undefined,
      checkedAt: check.checkedAt,
    };

    const tasks: Promise<void>[] = [];

    if (monitor.notifyEmail) {
      tasks.push(this.sendEmailSafely(monitor.userId, notification));
    }
    if (monitor.notifyWebhookUrl) {
      tasks.push(this.sendWebhookSafely(monitor.notifyWebhookUrl, notification));
    }

    await Promise.allSettled(tasks);
  }

  private async sendEmailSafely(userId: string, notification: FailureNotification): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return;
      }
      await this.emailNotifier.send(notification, user.email);
    } catch (error) {
      this.logger.error('Failed to send email notification', error);
    }
  }

  private async sendWebhookSafely(url: string, notification: FailureNotification): Promise<void> {
    try {
      await this.webhookNotifier.send(notification, url);
    } catch (error) {
      this.logger.error('Failed to send webhook notification', error);
    }
  }
}
