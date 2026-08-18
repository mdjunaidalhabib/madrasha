export type NotificationRecipient = string | { to: string; vars?: Record<string, string | number> };

export interface SendNotificationRequestDto {
  channel: "SMS" | "EMAIL";
  /// One or many recipients (phone numbers for SMS, emails for EMAIL) -
  /// sending to a class/list of guardians in one call is the common case.
  /// A recipient can be a plain string (sent as-is, the original manual
  /// compose behavior) or `{ to, vars }` so `message` is treated as a
  /// per-recipient `{placeholder}` template (used by personalized bulk
  /// sends, e.g. exam results).
  recipients: NotificationRecipient[];
  subject?: string; // EMAIL only
  message: string;
}

export interface NotificationQueryDto {
  channel?: string;
  status?: string;
  limit?: string;
}

export interface NotificationSettingUpdateDto {
  isEnabled?: boolean;
  template?: string;
}
