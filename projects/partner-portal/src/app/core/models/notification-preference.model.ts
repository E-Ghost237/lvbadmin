export type NotificationCategory = 'TRANSACTIONNEL_CRITIQUE' | 'TRANSACTIONNEL' | 'SUPPORT' | 'MARKETING';

/**
 * `GET /v1/notification-preferences` (`GetNotificationPreferencesUseCase`)
 * — a list of named categories, not a bare `Record<string, boolean>`.
 * `can_disable` is `false` for `TRANSACTIONNEL_CRITIQUE` (delivery codes,
 * OTP, incidents — NOTIF-02, never disableable) and the PUT should be
 * blocked client-side for those rather than relying only on the server
 * rejecting it.
 */
export interface NotificationPreference {
  category: NotificationCategory;
  enabled: boolean;
  can_disable: boolean;
}
