import type { AxiosRequestConfig, AxiosResponse } from "axios";
import api, { cachedGet } from "./api";

/**
 * Attendance v3 admin API - leaves, consecutive-absence alerts, sub-day
 * sessions, analytics and the payroll link (contract:
 * backend/src/modules/attendance/ATTENDANCE_V3_API.md, sections 2-5).
 * Every function unwraps the `{ success, data }` envelope and returns the
 * typed `data`. Pass `{ silent: true }` to skip the generic error toast.
 */

export type AttendeeType = "STUDENT" | "TEACHER" | "STAFF";
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "LEAVE";
export type LeaveType = "sick" | "family" | "travel" | "other";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const ATTENDEE_TYPES: AttendeeType[] = ["STUDENT", "TEACHER", "STAFF"];
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "LEAVE"];
export const LEAVE_TYPES: LeaveType[] = ["sick", "family", "travel", "other"];
export const LEAVE_STATUSES: LeaveStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

type Envelope<T> = { success?: boolean; message?: string; data: T };
const unwrap = <T>(res: AxiosResponse<Envelope<T>>): T => res.data?.data;
const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Drops empty filter values so they never reach the query string. */
const clean = (params: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
};

/* ---------------------------------------------------------------- leaves */

export interface LeaveRequest {
  id: number;
  attendee_type: AttendeeType;
  attendee_id: number;
  attendee_name: string;
  class_name?: string | null;
  roll?: string | number | null;
  from_date: string;
  to_date: string;
  days: number;
  leave_type: LeaveType;
  reason: string;
  status: LeaveStatus;
  requested_via: "guardian" | "office" | string;
  requested_by_name?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
}

export interface LeaveListQuery {
  status?: LeaveStatus | "";
  attendee_type?: AttendeeType | "";
  attendee_id?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface LeavePage {
  items: LeaveRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateLeavePayload {
  attendee_type: AttendeeType;
  attendee_id: number;
  from_date: string;
  to_date: string;
  leave_type: LeaveType;
  reason: string;
  approve_now?: boolean;
}

export interface ApproveLeaveResult {
  request: LeaveRequest;
  days_marked: number;
  days_skipped: number;
}

export interface ConsecutiveAbsence {
  student_id: number;
  name: string;
  class_name: string | null;
  roll: string | number | null;
  guardian_phone: string | null;
  streak: number;
  since: string;
}

const LEAVES = "/attendance-leaves";

export const leaveApi = {
  list: async (query: LeaveListQuery, config?: AxiosRequestConfig): Promise<LeavePage> => {
    const res = await api.get(LEAVES, { ...config, params: clean({ ...query }) });
    const data = unwrap<any>(res) ?? {};
    const items = asArray<LeaveRequest>(Array.isArray(data) ? data : data.items);
    return {
      items,
      total: num(data.total, items.length),
      page: num(data.page, query.page ?? 1),
      limit: num(data.limit, query.limit ?? items.length),
    };
  },
  get: async (id: number) => unwrap<LeaveRequest>(await api.get(`${LEAVES}/${id}`)),
  create: async (payload: CreateLeavePayload) =>
    unwrap<LeaveRequest | ApproveLeaveResult>(await api.post(LEAVES, payload)),
  approve: async (id: number, note?: string) =>
    unwrap<ApproveLeaveResult>(await api.post(`${LEAVES}/${id}/approve`, clean({ note }))),
  reject: async (id: number, note: string) =>
    unwrap<LeaveRequest>(await api.post(`${LEAVES}/${id}/reject`, { note })),
  cancel: async (id: number, note?: string) =>
    unwrap<LeaveRequest>(await api.post(`${LEAVES}/${id}/cancel`, clean({ note }))),
};

export const alertsApi = {
  consecutive: async (days?: number, config?: AxiosRequestConfig) =>
    asArray<ConsecutiveAbsence>(
      unwrap(await api.get(`${LEAVES}/alerts/consecutive`, { ...config, params: clean({ days }) })),
    ),
};

/* -------------------------------------------------------------- sessions */

export interface AttendanceSession {
  id: number;
  name: string;
  start_time: string | null;
  end_time: string | null;
  residential_only: boolean;
  sort_order: number;
  is_active: boolean;
  /** Number of SessionAttendance rows - delete needs ?force=1 when > 0. */
  record_count?: number;
}

export interface SessionMarkResult {
  saved_count: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Student ids not saved (unknown / inactive / other class / non-residential). */
  skipped: number[];
}

/** Machine-readable error code from the shared error envelope (`errors.code`). */
export const apiErrorCode = (err: unknown): string | undefined => {
  const body = (err as any)?.response?.data;
  return body?.errors?.code ?? body?.code ?? undefined;
};

export interface SessionPayload {
  name: string;
  start_time?: string | null;
  end_time?: string | null;
  residential_only?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface SessionSheetStudent {
  student_id: number;
  name: string;
  roll: string | number | null;
  class_id: number | null;
  /// 1 = residential, 2 = non-residential (Student.residencyType)
  residency_type: number | null;
  status: AttendanceStatus | null;
  remarks: string | null;
}

export interface SessionSheet {
  session: AttendanceSession;
  date: string;
  off_day: null | false | { reason?: string | null; title?: string | null } | boolean;
  editable: boolean;
  students: SessionSheetStudent[];
}

export interface SessionMarkPayload {
  session_id: number;
  date: string;
  class_id?: number;
  entries: Array<{ student_id: number; status: AttendanceStatus; remarks?: string }>;
}

export interface SessionCounts {
  PRESENT: number;
  LATE: number;
  ABSENT: number;
  LEAVE: number;
  total: number;
  percentage: number;
}

export interface SessionReport {
  sessions: AttendanceSession[];
  rows: Array<{
    student_id: number;
    name: string;
    roll: string | number | null;
    class_name: string | null;
    per_session: Record<string, SessionCounts>;
    overall_percentage: number;
  }>;
}

const SESSIONS = "/attendance-sessions";

export const sessionApi = {
  list: async (includeInactive = false, config?: AxiosRequestConfig) =>
    asArray<AttendanceSession>(
      unwrap(
        await api.get(`${SESSIONS}/sessions`, {
          ...config,
          params: clean({ include_inactive: includeInactive ? 1 : undefined }),
        }),
      ),
    ),
  create: async (payload: SessionPayload) =>
    unwrap<AttendanceSession>(await api.post(`${SESSIONS}/sessions`, payload)),
  update: async (id: number, payload: Partial<SessionPayload>) =>
    unwrap<AttendanceSession>(await api.patch(`${SESSIONS}/sessions/${id}`, payload)),
  remove: async (id: number, force = false, config?: AxiosRequestConfig) =>
    unwrap<unknown>(
      await api.delete(`${SESSIONS}/sessions/${id}`, {
        ...config,
        params: clean({ force: force ? 1 : undefined }),
      }),
    ),
  sheet: async (q: { session_id: number; date: string; class_id: number }) => {
    const data = unwrap<SessionSheet>(await api.get(`${SESSIONS}/sheet`, { params: q }));
    return { ...data, students: asArray<SessionSheetStudent>(data?.students) };
  },
  mark: async (payload: SessionMarkPayload): Promise<SessionMarkResult> => {
    const data = unwrap<any>(await api.post(`${SESSIONS}/mark`, payload)) ?? {};
    return {
      saved_count: num(data.saved_count ?? data.savedCount),
      created: num(data.created),
      updated: num(data.updated),
      unchanged: num(data.unchanged),
      skipped: asArray<number>(data.skipped).map(Number),
    };
  },
  report: async (q: { from: string; to: string; class_id?: number; session_id?: number }) => {
    const data = unwrap<SessionReport>(await api.get(`${SESSIONS}/report`, { params: clean({ ...q }) }));
    return {
      sessions: asArray<AttendanceSession>(data?.sessions),
      rows: asArray<SessionReport["rows"][number]>(data?.rows),
    };
  },
};

/* ------------------------------------------------------------- analytics */

export interface Totals {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  unmarked: number;
  rate: number;
}

export interface Overview {
  date: string;
  off_day: null | { reason: string | null; title: string | null };
  students: Totals;
  teachers: Totals;
  staff: Totals;
  classes: Array<Totals & { class_id: number; class_name: string }>;
}

export interface TrendPoint {
  date: string;
  off: boolean;
  present: number;
  late: number;
  absent: number;
  leave: number;
  total: number;
  rate: number;
}

export interface AttendanceStats {
  PRESENT?: number;
  LATE?: number;
  ABSENT?: number;
  LEAVE?: number;
  working_days?: number;
  unmarked?: number;
  attended?: number;
  counted_days?: number;
  percentage: number;
}

export interface LowAttendanceRow extends AttendanceStats {
  attendee_id: number;
  name: string;
  class_name?: string | null;
  roll?: string | number | null;
  guardian_phone?: string | null;
  designation?: string | null;
}

export interface PayrollSummaryRow {
  attendee_id: number;
  name: string;
  salary: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  unmarked: number;
  late_penalty: number;
  worked_minutes: number;
  avg_check_in: string | null;
  per_day_salary: number;
  suggested_deduction: number;
  designation?: string | null;
  percentage?: number;
  deductible_days?: number;
  /** Always null for STAFF (payroll records are teachers-only). */
  payroll: null | {
    id: number;
    status: string;
    deductions: number;
    net_amount: number;
    basic_salary?: number;
    allowances?: number;
  };
}

export interface PayrollSummary {
  month: string;
  attendee_type?: "TEACHER" | "STAFF";
  leave_mode?: "excluded" | "present" | "absent";
  working_days: number;
  deduct_absent: boolean;
  rows: PayrollSummaryRow[];
}

export interface PayrollSkippedItem {
  teacher_id: number;
  reason: "no_record" | "not_pending" | "exceeds_salary" | string;
}

export interface PayrollApplyResult {
  month: string;
  updated: number;
  skipped: number;
  skipped_items: PayrollSkippedItem[];
}

const ANALYTICS = "/attendance-analytics";

const emptyTotals = (): Totals => ({
  total: 0,
  present: 0,
  late: 0,
  absent: 0,
  leave: 0,
  unmarked: 0,
  rate: 0,
});

export const analyticsApi = {
  overview: async (date?: string, config?: AxiosRequestConfig): Promise<Overview> => {
    const data = unwrap<any>(await api.get(`${ANALYTICS}/overview`, { ...config, params: clean({ date }) })) ?? {};
    return {
      date: data.date ?? date ?? "",
      off_day: data.off_day ?? null,
      students: data.students ?? emptyTotals(),
      teachers: data.teachers ?? emptyTotals(),
      staff: data.staff ?? emptyTotals(),
      classes: asArray(data.classes),
    };
  },
  trend: async (q: { month: string; attendee_type?: AttendeeType; class_id?: number }, config?: AxiosRequestConfig) =>
    asArray<TrendPoint>(unwrap(await api.get(`${ANALYTICS}/trend`, { ...config, params: clean({ ...q }) }))),
  lowAttendance: async (
    q: { from: string; to: string; attendee_type?: AttendeeType; class_id?: number; threshold?: number },
    config?: AxiosRequestConfig,
  ) => {
    const data = unwrap<any>(
      await api.get(`${ANALYTICS}/low-attendance`, { ...config, params: clean({ ...q }) }),
    ) ?? {};
    return { threshold: num(data.threshold, q.threshold ?? 0), rows: asArray<LowAttendanceRow>(data.rows) };
  },
  payrollSummary: async (q: { month: string; attendee_type: "TEACHER" | "STAFF" }): Promise<PayrollSummary> => {
    const data = unwrap<any>(await api.get(`${ANALYTICS}/payroll-summary`, { params: q })) ?? {};
    return {
      month: data.month ?? q.month,
      working_days: num(data.working_days),
      deduct_absent: Boolean(data.deduct_absent),
      rows: asArray<PayrollSummaryRow>(data.rows),
    };
  },
  payrollApply: async (payload: { month: string; items: Array<{ teacher_id: number; deduction: number }> }) => {
    const data = unwrap<any>(await api.post(`${ANALYTICS}/payroll-apply`, payload)) ?? {};
    const skippedItems = asArray<PayrollSkippedItem>(data.skipped_items);
    return {
      month: String(data.month ?? payload.month),
      updated: Array.isArray(data.updated) ? data.updated.length : num(data.updated),
      skipped: num(data.skipped, skippedItems.length),
      skipped_items: skippedItems,
    } as PayrollApplyResult;
  },
};

/* --------------------------------------------- lookups (existing endpoints) */

export interface ClassOption {
  class_id: number;
  class_name: string;
  division_id?: number;
  division_name?: string;
}

export interface PersonOption {
  id: number;
  name: string;
  roll?: string | number | null;
  class_id?: number | null;
  extra?: string | null;
}

const listOf = (res: AxiosResponse<any>) => {
  const data = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(data) ? data.filter((x) => x && typeof x === "object") : [];
};

/**
 * Every class across every division - /madrasa-classes answers one
 * division at a time (same approach as AttendanceReportPage).
 */
export async function loadAllClasses(): Promise<ClassOption[]> {
  const divisions = listOf(await cachedGet("/madrasa-divisions"));
  const perDivision = await Promise.all(
    divisions.map(async (d: any) => {
      const rows = listOf(await cachedGet(`/madrasa-classes?division_id=${d.division_id}`));
      return rows.map((c: any) => ({
        class_id: Number(c.class_id),
        class_name: String(c.class_name_bn ?? c.class_name ?? c.name ?? `#${c.class_id}`),
        division_id: d.division_id != null ? Number(d.division_id) : undefined,
        division_name: d.division_name_bn ?? undefined,
      }));
    }),
  );
  return perDivision.flat();
}

/** Students / teachers / staff for pickers. */
export async function loadPeople(type: AttendeeType): Promise<PersonOption[]> {
  const url = type === "STUDENT" ? "/students" : type === "TEACHER" ? "/teachers" : "/staff";
  const rows = listOf(await cachedGet(url));
  return rows.map((p: any) => ({
    id: Number(p.id),
    name: String(p.name_bn || p.name || p.name_en || `#${p.id}`),
    roll: p.roll ?? null,
    class_id: p.class_id != null ? Number(p.class_id) : null,
    extra: p.designation ?? p.phone ?? p.mobile ?? null,
  }));
}

/* ------------------------------------------------------------- date utils */

const pad = (n: number) => String(n).padStart(2, "0");

/** Local YYYY-MM-DD (not UTC - avoids the off-by-one before 6am in BD). */
export const localIso = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const currentMonth = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthStartIso = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
export const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localIso(d);
};
