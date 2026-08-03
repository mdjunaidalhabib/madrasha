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
};

/* ================= ATTENDANCE ================= */

export type AttendeeType = "STUDENT" | "TEACHER" | "STAFF";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

export interface AttendanceEntry {
  attendee_id: number;
  status: AttendanceStatus;
  remarks?: string;
}

export const attendanceApi = {
  bulkMark: (payload: {
    attendee_type: AttendeeType;
    date: string; // "YYYY-MM-DD"
    class_id?: number;
    entries: AttendanceEntry[];
  }) => api.post("/attendance/bulk", payload),

  list: (params: {
    date?: string;
    from?: string;
    to?: string;
    class_id?: number;
    attendee_type?: AttendeeType;
    attendee_id?: number;
  }) => api.get("/attendance", { params }),

  summary: (params: { attendee_id: number; attendee_type: AttendeeType; month?: string }) =>
    api.get("/attendance/summary", { params }),
};

/* ================= CLASS & EXAM ROUTINE ================= */

export const classRoutineApi = {
  list: (classId?: number) =>
    api.get("/class-routine", { params: classId ? { class_id: classId } : {} }),
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

export const examRoutineApi = {
  list: (params: { exam_id?: number; class_id?: number }) =>
    api.get("/exam-routine", { params }),
  create: (payload: {
    exam_id: number;
    class_id: number;
    subject: string;
    exam_date: string;
    start_time: string;
    end_time: string;
    room_no?: string;
  }) => api.post("/exam-routine", payload),
  update: (id: number, payload: Record<string, unknown>) =>
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
