export type DeviceConnectionStatus = "online" | "offline" | "unknown";
export type PunchSyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
export type SmsStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

export interface AttendanceDevice {
  id: number;
  /** The K40's device code (deviceCode on the backend). */
  device_id: string;
  name: string;
  ip: string;
  port: number;
  is_active: boolean;
  status: DeviceConnectionStatus;
  /** Last connector heartbeat. */
  last_seen_at: string | null;
  /** Last time the connector actually reached the K40. */
  last_device_contact_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  poll_interval_sec: number;
  test_requested_at: string | null;
  last_test_at?: string | null;
  last_test_ok?: boolean | null;
  last_test_message?: string | null;
}

export interface CreateDevicePayload {
  device_id: string;
  name: string;
  ip: string;
  port: number;
  comm_password?: string;
  poll_interval_sec?: number;
}

export interface UpdateDevicePayload {
  name?: string;
  ip?: string;
  port?: number;
  comm_password?: string;
  poll_interval_sec?: number;
  is_active?: boolean;
}

export type CreatedDevice = AttendanceDevice & { raw_key: string };

export interface StudentMapping {
  student_id: number;
  name_bn: string;
  roll: number | string | null;
  class_id: number | null;
  class_name?: string | null;
  device_user_id: string | number | null;
}

export interface MappingPage {
  items: StudentMapping[];
  total: number;
}

export interface MappingQuery {
  search?: string;
  class_id?: number | string;
  page?: number;
  limit?: number;
}

export interface UnmappedDeviceUser {
  device_user_id: string | number;
  device_name: string | null;
  punch_count: number;
  last_punch_at: string | null;
}

export interface TodayRow {
  student_id: number;
  name_bn: string;
  class_name: string | null;
  device_user_id: string | number | null;
  check_in_at: string | null;
  device_name: string | null;
  sync_status: PunchSyncStatus;
  received_at: string | null;
  sms_status?: SmsStatus | null;
}

export interface TodaySummary {
  present: number;
  unmapped: number;
  total_punches: number;
  last_sync_at: string | null;
}

export interface TodayReport {
  summary: TodaySummary;
  rows: TodayRow[];
}

export interface TodayQuery {
  date?: string;
  device_id?: number | string;
}
