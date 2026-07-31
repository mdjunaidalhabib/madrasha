export interface SendNotificationRequestDto {
  channel: "SMS" | "EMAIL";
  /// One or many recipients (phone numbers for SMS, emails for EMAIL) -
  /// sending to a class/list of guardians in one call is the common case.
  recipients: string[];
  subject?: string; // EMAIL only
  message: string;
}

export interface NotificationQueryDto {
  channel?: string;
  status?: string;
  limit?: string;
}
