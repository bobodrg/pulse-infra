export interface FailureNotification {
  monitorName: string;
  monitorUrl: string;
  statusCode?: number;
  error?: string;
  checkedAt: Date;
}

/**
 * Common shape for every notification channel. Adding a new channel (e.g.
 * SMS, Slack app) means implementing this interface and wiring it into
 * NotificationsService — no changes needed anywhere else.
 */
export interface Notifier {
  send(notification: FailureNotification, target: string): Promise<void>;
}
