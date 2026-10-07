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
  /** Device clock minus connector PC clock, in seconds (null = not reported yet). */
  clock_drift_sec?: number | null;
  users_synced_version?: string | null;
  /** Current desired user-list version; equal to users_synced_version when in sync. */
  users_version?: string | null;
  users_in_sync?: boolean;
  last_user_sync_at?: string | null;
  user_sync_error?: string | null;
  device_user_count?: number | null;
  offline_alerted_at?: string | null;
  /** Punches still waiting in the connector's local queue (null = old connector). */
  queue_pending?: number | null;
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
  card_number?: string | null;
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


/* ---------------- attendee types (students / teachers / staff) ---------------- */

export type AttendeeType = "STUDENT" | "TEACHER" | "STAFF";

export const ATTENDEE_TYPES: AttendeeType[] = ["STUDENT", "TEACHER", "STAFF"];

/* ---------------- today ---------------- */

export type DayStatus = "PRESENT" | "LATE" | "ABSENT" | "LEAVE";

export interface TodayRow {
  attendee_type: AttendeeType;
  attendee_id: number | null;
  /** Kept for backward compatibility (students only). */
  student_id: number | null;
  /** Person name (or "not mapped"). */
  name_bn: string;
  roll: number | string | null;
  class_id: number | null;
  class_name: string | null;
  device_user_id: string | number | null;
  mapped: boolean;
  note: string | null;
  status: DayStatus | null;
  check_in_at: string | null;
  check_out_at: string | null;
  last_punch_at: string | null;
  punch_count: number;
  device_id: number | null;
  device_name: string | null;
  sync_status: PunchSyncStatus;
  received_at: string | null;
  sms_status?: SmsStatus | null;
}

export interface TodaySummary {
  present: number;
  late: number;
  absent: number;
  not_arrived: number;
  checked_out: number;
  unmapped: number;
  total_punches: number;
  rejected_punches: number;
  last_sync_at: string | null;
  mapped_total: number;
}

export interface NotArrivedItem {
  attendee_id: number;
  name: string;
  roll: number | string | null;
  class_id: number | null;
  class_name: string | null;
  status: "ABSENT" | "LEAVE" | null;
}

export interface ClassSummary {
  class_id: number | null;
  class_name: string | null;
  mapped_total: number;
  present: number;
  late: number;
  absent: number;
}

export interface TodayReport {
  date: string | null;
  attendee_type: AttendeeType;
  is_holiday: boolean;
  holiday_title: string | null;
  summary: TodaySummary;
  rows: TodayRow[];
  not_arrived: NotArrivedItem[];
  classes: ClassSummary[];
}

export interface TodayQuery {
  date?: string;
  device_id?: number | string;
  attendee_type?: AttendeeType;
}

/* ---------------- settings + holidays ---------------- */

export interface DeviceSettings {
  late_enabled: boolean;
  /** "HH:mm" local time. */
  student_start_time: string;
  teacher_start_time: string;
  late_grace_minutes: number;
  auto_absent_enabled: boolean;
  absent_cutoff_time: string;
  /** Minutes auto absent may wait past the cutoff for devices to sync (0 = never wait). */
  auto_absent_max_wait_minutes: number;
  /** Guardian SMS for attendance marked by hand (today, students). */
  manual_sms: boolean;
  checkout_enabled: boolean;
  checkout_after_time: string;
  /** 0 = Sunday ... 6 = Saturday (JS getDay order). */
  weekly_off_days: number[];
  offline_alert_enabled: boolean;
  offline_alert_minutes: number;
  alert_phone: string | null;
  auto_time_sync: boolean;
  /** "registration": student = রেজি. নং, teacher = 90000 + রেজি., staff = 95000 + রেজি.; "auto": count up from pin_start. */
  pin_mode: PinMode;
  pin_start: number;
  /** Read-only server warnings (e.g. registration numbers reaching the teacher range). */
  pin_warnings?: string[];
}

export type PinMode = "registration" | "auto";

export interface AttendanceHoliday {
  id: number;
  /** "YYYY-MM-DD" */
  date: string;
  title: string;
}

/* ---------------- people / cards ---------------- */

export interface CardPerson {
  attendee_type: AttendeeType;
  attendee_id: number;
  name: string;
  name_en: string | null;
  image: string | null;
  roll: number | string | null;
  registration_no: string | number | null;
  class_id: number | null;
  class_name: string | null;
  designation: string | null;
  /** K40 user id (PIN); null = not assigned yet. */
  device_user_id: string | null;
  card_number: string | null;
  auto_assigned: boolean;
}

export interface PeopleQuery {
  attendee_type: AttendeeType;
  /** Exact person (the profile page's lookup). */
  attendee_id?: number;
  class_id?: number | string;
  search?: string;
  has_card?: boolean;
  page?: number;
  limit?: number;
}

export interface PeoplePage {
  items: CardPerson[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/* ---------------- enrollment ---------------- */

export type EnrollmentStatus = "pending" | "waiting" | "completed" | "failed" | "expired" | "cancelled";

export const TERMINAL_ENROLLMENT: EnrollmentStatus[] = ["completed", "failed", "expired", "cancelled"];

export interface Enrollment {
  id: number;
  device_id: number;
  device_name: string | null;
  attendee_type: AttendeeType;
  attendee_id: number;
  person_name: string | null;
  device_user_id: string | null;
  status: EnrollmentStatus;
  card_number: string | null;
  message: string | null;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
  connector_online: boolean;
}
