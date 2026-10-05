export interface OverviewQueryDto {
  date?: string;
}

export interface TrendQueryDto {
  month?: string; // "YYYY-MM", default current month
  attendee_type?: string; // default STUDENT
  class_id?: string;
}

export interface LowAttendanceQueryDto {
  from?: string;
  to?: string;
  attendee_type?: string; // default STUDENT
  class_id?: string;
  threshold?: string; // default policy.lowAttendancePercent
}

export interface PayrollSummaryQueryDto {
  month?: string; // "YYYY-MM", required
  attendee_type?: string; // TEACHER | STAFF, default TEACHER
}

export interface PayrollApplyItemDto {
  teacher_id: number | string;
  deduction: number | string;
}

export interface PayrollApplyRequestDto {
  month?: string;
  items?: PayrollApplyItemDto[];
}
