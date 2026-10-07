import { Injectable } from '@nestjs/common';
import { FailureNotification, Notifier } from '../notifier.interface.js';

@Injectable()
export class WebhookNotifier implements Notifier {
  async send(notification: FailureNotification, target: string): Promise<void> {
    const message = `${notification.monitorName} (${notification.monitorUrl}) is down${
      notification.statusCode ? ` (HTTP ${notification.statusCode})` : ''
    }${notification.error ? `: ${notification.error}` : ''}`;

    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Both `text` (Slack incoming webhooks) and `content` (Discord
      // webhooks) are sent so the same payload works unmodified against
      // either, without per-channel configuration.
      body: JSON.stringify({
        text: message,
        content: message,
        monitorName: notification.monitorName,
        monitorUrl: notification.monitorUrl,
        statusCode: notification.statusCode,
        error: notification.error,
        checkedAt: notification.checkedAt.toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with HTTP ${response.status}`);
    }
  }
}
