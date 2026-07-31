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
}
