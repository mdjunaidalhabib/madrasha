import api, { cachedGet } from "./api";

/**
 * Phase 1 API bindings: Admission Approval, Attendance, Class/Exam
 * Routine, and Student Promotion. Thin wrappers only (same pattern as
 * the rest of this codebase - pages call these directly) so page/UI
 * components can be built on top without re-deriving the endpoint shapes.
 */

/* ================= ADMISSION APPROVAL ================= */

export const admissionApi = {
  listPending: () => cachedGet("/students/admission/pending", undefined, 0),
  approve: (studentId: number) => api.patch(`/students/${studentId}/approve`),
  reject: (studentId: number, reason: string) =>
    api.patch(`/students/${studentId}/reject`, { reason }),
  // Bulk review: one request (and one activity-log row) for the whole
  // selection; data = { succeeded: number[], failed: { id, message }[] }.
  approveBulk: (studentIds: number[]) => api.patch(`/students/admission/approve-bulk`, { ids: studentIds }),
  rejectBulk: (studentIds: number[], reason: string) =>
    api.patch(`/students/admission/reject-bulk`, { ids: studentIds, reason }),
  listRejected: () => cachedGet("/students/admission/rejected", undefined, 0),
  permanentlyDeleteRejected: (studentId: number) => api.delete(`/students/${studentId}/rejected-application`),
  permanentlyDeleteRejectedBulk: (studentIds: number[]) =>
    api.delete(`/students/admission/rejected-bulk`, { data: { ids: studentIds } }),
};

/* ================= ATTENDANCE ================= */

export type AttendeeType = "STUDENT" | "TEACHER" | "STAFF";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

export interface AttendanceEntry {
  attendee_id: number;
  status: AttendanceStatus;
  remarks?: string;
}

/** Where a row came from. `k40` (device) and `leave` (approved leave) are
 * "protected": bulk marking skips them unless overridden with a reason. */
export type AttendanceSource = string; // "manual" | "k40" | "auto" | "leave"
export const PROTECTED_ATTENDANCE_SOURCES: readonly string[] = ["k40", "leave"];

/** Raw attendance row as returned by GET /attendance (camelCase Prisma row). */
export interface AttendanceRow {
  id: number;
  attendeeType: AttendeeType;
  attendeeId: number;
  classId?: number | null;
  date: string;
  status: AttendanceStatus;
  source?: AttendanceSource | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  remarks?: string | null;
  markedById?: number | null;
}

export interface AttendanceBulkPayload {
  attendee_type: AttendeeType;
  date: string; // "YYYY-MM-DD"
  class_id?: number;
  entries: AttendanceEntry[];
  /** Required when changing an existing row of a past date or overriding a protected row. */
  reason?: string;
  /** Needs `attendance.edit` + reason: also change k40/leave rows. */
  override_protected?: boolean;
}

export interface AttendanceBulkResult {
  savedCount: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: Array<{ attendee_id: number; source: AttendanceSource }>;
}

export interface AttendanceStats {
  PRESENT: number;
  LATE: number;
  ABSENT: number;
  LEAVE: number;
  working_days: number;
  /** Taken working days with no row for this person (counted absent). */
  unmarked: number;
  /** Absent-equivalents added by the late rule. */
  late_penalty: number;
  attended: number;
  counted_days: number;
  /** 0..100, one decimal. */
  percentage: number;
}

export interface AttendanceSummary extends AttendanceStats {
  month?: string;
  from: string;
  to: string;
  /** Recorded rows (kept for old callers). */
  total: number;
}

export interface AttendanceChangeItem {
  id: number;
  attendance_id: number | null;
  attendee_type: AttendeeType;
  attendee_id: number;
  date: string;
  old_status: AttendanceStatus | null;
  new_status: AttendanceStatus | null;
  old_source: AttendanceSource | null;
  new_source: AttendanceSource | null;
  reason: string | null;
  via: string;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_at: string;
}

export interface AttendanceDayInfo {
  date: string;
  today: string;
  off: boolean;
  reason: "holiday" | "weekly_off" | null;
  title: string | null;
  is_future: boolean;
  within_window: boolean;
  can_edit_past: boolean;
  edit_window_days: number;
}

export interface AttendanceCalendar {
  working_days: string[];
  off_days: Array<{ date: string; reason: string; title: string | null }>;
}

export type LeaveMode = "excluded" | "present" | "absent";

export interface AttendancePolicy {
  edit_window_days: number;
  late_to_absent_count: number;
  leave_mode: LeaveMode;
  low_attendance_percent: number;
  consecutive_absent_days: number;
  payroll_deduct_absent: boolean;
}

/** `{ success, data }` -> data (falls back to the body itself). */
const unwrapData = <T,>(res: { data: any }): T => {
  const body = res?.data;
  return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
};

const unwrapList = <T,>(res: { data: any }): T[] => {
  const data = unwrapData<T[]>(res);
  return Array.isArray(data) ? data : [];
};

/** Bulk response: fields may sit in `data` or at the top level ("extra"). */
const unwrapBulk = (res: { data: any }): AttendanceBulkResult => {
  const body = res?.data || {};
  const merged = { ...body, ...(body.data && typeof body.data === "object" ? body.data : {}) };
  const created = Number(merged.created ?? 0);
  const updated = Number(merged.updated ?? 0);
  return {
    savedCount: Number(merged.savedCount ?? created + updated),
    created,
    updated,
    unchanged: Number(merged.unchanged ?? 0),
    skipped: Array.isArray(merged.skipped) ? merged.skipped : [],
  };
};

export const attendanceApi = {
  /** Raw axios response (old callers). Prefer `bulk`. */
  bulkMark: (payload: AttendanceBulkPayload) => api.post("/attendance/bulk", payload),

  /** Bulk mark resolved to the typed v3 result `{ created, updated, unchanged, skipped }`. */
  bulk: async (payload: AttendanceBulkPayload) => unwrapBulk(await api.post("/attendance/bulk", payload)),

  /** Correct one row (reason required, audited as `correction`). */
  correct: async (id: number, payload: { status: AttendanceStatus; remarks?: string; reason: string }) =>
    unwrapData<AttendanceRow>(await api.patch(`/attendance/${id}`, payload)),

  list: (params: {
    date?: string;
    from?: string;
    to?: string;
    class_id?: number;
    attendee_type?: AttendeeType;
    attendee_id?: number;
  }) => api.get("/attendance", { params }),

  /** Typed list rows. */
  rows: async (params: {
    date?: string;
    from?: string;
    to?: string;
    class_id?: number;
    attendee_type?: AttendeeType;
    attendee_id?: number;
  }) => unwrapList<AttendanceRow>(await api.get("/attendance", { params })),

  summary: (params: {
    attendee_id: number;
    attendee_type: AttendeeType;
    month?: string;
    from?: string;
    to?: string;
  }) => api.get("/attendance/summary", { params }),

  /** Typed summary with the v3 fields (working_days, unmarked, late_penalty, percentage...). */
  summaryData: async (params: {
    attendee_id: number;
    attendee_type: AttendeeType;
    month?: string;
    from?: string;
    to?: string;
  }) => unwrapData<AttendanceSummary>(await api.get("/attendance/summary", { params })),

  /** Bulk stats; for STUDENT + class_id every active student of the class. */
  stats: async (params: {
    attendee_type: AttendeeType;
    from: string;
    to: string;
    class_id?: number;
    attendee_ids?: number[];
  }) => {
    const { attendee_ids, ...rest } = params;
    return unwrapList<AttendanceStats & { attendee_id: number }>(
      await api.get("/attendance/stats", {
        params: { ...rest, ...(attendee_ids?.length ? { attendee_ids: attendee_ids.join(",") } : {}) },
      }),
    );
  },

  /** Audit trail of one attendee (optionally one date), newest first. */
  history: async (params: { attendee_type: AttendeeType; attendee_id: number; date?: string }) =>
    unwrapList<AttendanceChangeItem>(await api.get("/attendance/history", { params })),

  /** Audit trail of one attendance row. */
  rowHistory: async (id: number) => unwrapList<AttendanceChangeItem>(await api.get(`/attendance/${id}/history`)),

  dayInfo: async (date: string) =>
    unwrapData<AttendanceDayInfo>(await api.get("/attendance/day-info", { params: { date } })),

  calendar: async (from: string, to: string): Promise<AttendanceCalendar> => {
    const data = unwrapData<Partial<AttendanceCalendar> | null>(
      await api.get("/attendance/calendar", { params: { from, to } }),
    );
    return {
      working_days: Array.isArray(data?.working_days) ? data!.working_days! : [],
      off_days: Array.isArray(data?.off_days) ? data!.off_days! : [],
    };
  },

  getPolicy: async () => unwrapData<AttendancePolicy>(await api.get("/attendance/policy")),

  updatePolicy: async (policy: AttendancePolicy) =>
    unwrapData<AttendancePolicy>(await api.put("/attendance/policy", policy)),
};

/* ================= CLASS & EXAM ROUTINE ================= */

export const classRoutineApi = {
  list: (classId?: number) =>
    api.get("/class-routine", { params: classId ? { class_id: classId } : {} }),
  overview: () => api.get("/class-routine/overview"),
  create: (payload: {
    class_id: number;
    day_of_week: number;
    subject: string;
    teacher_id?: number;
    start_time: string;
    end_time: string;
  }) => api.post("/class-routine", payload),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put(`/class-routine/${id}`, payload),
  remove: (id: number) => api.delete(`/class-routine/${id}`),
};

export type ExamRoutineStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export interface ExamRoutinePayload {
  exam_id: number;
  class_id: number;
  division_id?: number;
  subject: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room_no?: string;
  room_id?: number;
  max_capacity?: number;
  status?: ExamRoutineStatus;
  instructions?: string;
}

export const examRoutineApi = {
  list: (params: { exam_id?: number; class_id?: number }) =>
    api.get("/exam-routine", { params }),
  overview: () => api.get("/exam-routine/overview"),
  create: (payload: ExamRoutinePayload) => api.post("/exam-routine", payload),
  update: (id: number, payload: Partial<ExamRoutinePayload>) =>
    api.put(`/exam-routine/${id}`, payload),
  remove: (id: number) => api.delete(`/exam-routine/${id}`),
};

/* ================= STUDENT PROMOTION ================= */

export interface PromotionPreviewRow {
  student_id: number;
  name_bn: string;
  roll: number;
  result_status: "PASS" | "FAIL" | "ABSENT" | "NO_RESULT";
  suggested_status: "PROMOTED" | "RETAINED";
}

export const promotionApi = {
  preview: (payload: { from_class_id: number; from_year: string; exam_id?: number }) =>
    api.post<{ success: boolean; data: PromotionPreviewRow[] }>("/promotion/preview", payload),

  execute: (payload: {
    from_class_id: number;
    to_class_id: number;
    from_year: string;
    to_year: string;
    decisions: Array<{ student_id: number; status: "PROMOTED" | "RETAINED" | "TRANSFERRED" }>;
  }) => api.post("/promotion/execute", payload),
};
