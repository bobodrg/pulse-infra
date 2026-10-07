import { Module } from '@nestjs/common';
import { EmailNotifier } from './notifiers/email-notifier.service.js';
import { WebhookNotifier } from './notifiers/webhook-notifier.service.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  providers: [NotificationsService, EmailNotifier, WebhookNotifier],
  exports: [NotificationsService],
})
export class NotificationsModule {}
