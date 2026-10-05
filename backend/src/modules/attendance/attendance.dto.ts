export interface AttendanceEntryDto {
  attendee_id: number | string;
  status: string;
  remarks?: string;
}

export interface BulkMarkAttendanceRequestDto {
  attendee_type: string;
  date: string;
  class_id?: number | string;
  entries: AttendanceEntryDto[];
  /** Required when an existing row of a past date changes status. */
  reason?: string;
  /** Overwrite device (k40) / leave rows; needs attendance.edit + reason. */
  override_protected?: boolean | string;
}

export interface CorrectAttendanceRequestDto {
  status: string;
  remarks?: string | null;
  reason: string;
}

export interface AttendanceQueryDto {
  date?: string;
  from?: string;
  to?: string;
  class_id?: string;
  attendee_type?: string;
  attendee_id?: string;
}

export interface AttendanceSummaryQueryDto {
  attendee_id: string;
  attendee_type: string;
  month?: string; // "YYYY-MM"
  from?: string;
  to?: string;
}

export interface AttendanceStatsQueryDto {
  attendee_type?: string;
  month?: string;
  from?: string;
  to?: string;
  class_id?: string;
  /** Comma separated ids. */
  attendee_ids?: string;
}

export interface AttendanceHistoryQueryDto {
  attendee_type?: string;
  attendee_id?: string;
  date?: string;
  limit?: string;
}

export interface AttendanceCalendarQueryDto {
  from?: string;
  to?: string;
  month?: string;
}

export interface BulkMarkResult {
  savedCount: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: Array<{ attendee_id: number; source: string }>;
}
