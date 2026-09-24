import api from "./api";

/**
 * Exam Operations API bindings: Room/Hall, Invigilator Assignment, Seat
 * Allocation, Exam Attendance (backend modules mounted at /exam-rooms,
 * /exam-invigilators, /exam-seats, /exam-attendance). Thin typed wrappers
 * only, same pattern as phase1Api.ts/phase2Api.ts - pages call these
 * directly, no React Query.
 */

/* ================= EXAM ROOM ================= */

export interface ExamRoomRow {
  id: number;
  madrasaId: number;
  name: string;
  code: string;
  capacity: number;
  floor: string | null;
  location: string | null;
  isActive: boolean;
  notes: string | null;
}

export const examRoomApi = {
  list: (activeOnly?: boolean) =>
    api.get<{ success: boolean; data: ExamRoomRow[] }>("/exam-rooms", {
      params: activeOnly ? { active_only: true } : {},
    }),
  create: (payload: {
    name: string;
    code: string;
    capacity?: number;
    floor?: string;
    location?: string;
    notes?: string;
  }) => api.post("/exam-rooms", payload),
  update: (id: number, payload: Record<string, unknown>) => api.put(`/exam-rooms/${id}`, payload),
  deactivate: (id: number) => api.delete(`/exam-rooms/${id}`),
};

/* ================= INVIGILATOR ASSIGNMENT ================= */

export type InvigilatorType = "TEACHER" | "STAFF";
export type InvigilatorRole = "CHIEF" | "ASSISTANT";
export type InvigilatorAssignmentStatus = "ASSIGNED" | "CONFIRMED" | "CANCELLED";

export interface ExamInvigilatorAssignmentRow {
  id: number;
  examRoutineId: number;
  invigilatorType: InvigilatorType;
  invigilatorId: number;
  role: InvigilatorRole;
  status: InvigilatorAssignmentStatus;
  notes: string | null;
}

export const examInvigilatorApi = {
  listByRoutine: (examRoutineId: number) =>
    api.get<{ success: boolean; data: ExamInvigilatorAssignmentRow[] }>("/exam-invigilators", {
      params: { exam_routine_id: examRoutineId },
    }),
  assign: (payload: {
    exam_routine_id: number;
    invigilator_type: InvigilatorType;
    invigilator_id: number;
    role?: InvigilatorRole;
    notes?: string;
  }) => api.post("/exam-invigilators", payload),
  updateStatus: (id: number, status: InvigilatorAssignmentStatus) =>
    api.put(`/exam-invigilators/${id}`, { status }),
  remove: (id: number) => api.delete(`/exam-invigilators/${id}`),
};

/* ================= SEAT ALLOCATION ================= */

export type SeatAllocationStrategy = "SEQUENTIAL" | "ROLL_BASED" | "ALTERNATING" | "MANUAL";

export interface SeatAllocationRow {
  id: number;
  examRoutineId: number;
  examCandidateId: number;
  roomId: number;
  seatNo: string;
  rowNo: number | null;
  columnNo: number | null;
  strategy: SeatAllocationStrategy;
  isManualOverride: boolean;
  room?: { name: string; code: string };
}

export const examSeatApi = {
  listByRoutine: (examRoutineId: number) =>
    api.get<{ success: boolean; data: SeatAllocationRow[] }>("/exam-seats", {
      params: { exam_routine_id: examRoutineId },
    }),
  autoAllocate: (payload: {
    exam_routine_id: number;
    room_ids: number[];
    strategy?: SeatAllocationStrategy;
    preserve_manual_overrides?: boolean;
  }) => api.post<{ success: boolean; data: { allocated: number } }>("/exam-seats/allocate", payload),
  manualAdjust: (id: number, payload: { room_id: number; seat_no: string; row_no?: number; column_no?: number }) =>
    api.put(`/exam-seats/${id}`, payload),
  clear: (examRoutineId: number) => api.post("/exam-seats/clear", { exam_routine_id: examRoutineId }),
};

/* ================= EXAM ATTENDANCE ================= */

export type ExamAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "WITHHELD";

export const EXAM_ATTENDANCE_STATUS_VALUES: ExamAttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "WITHHELD",
];

export const EXAM_ATTENDANCE_STATUS_LABELS_BN: Record<ExamAttendanceStatus, string> = {
  PRESENT: "উপস্থিত",
  ABSENT: "অনুপস্থিত",
  LATE: "বিলম্বে উপস্থিত",
  EXCUSED: "মার্জিত অনুপস্থিতি",
  WITHHELD: "স্থগিত",
};

export interface ExamAttendanceRow {
  exam_candidate_id: number;
  attendance_id: number | null;
  room_id: number | null;
  status: ExamAttendanceStatus;
  remarks: string | null;
  marked_by_id: number | null;
  marked_at: string | null;
  is_locked: boolean;
  registration_no: string | null;
  candidate_no: string | null;
  student_name_bn: string;
  student_name_en: string | null;
  roll: number | null;
}

export const examAttendanceApi = {
  listByRoutine: (examRoutineId: number, params?: { status?: ExamAttendanceStatus; search?: string }) =>
    api.get<{ success: boolean; data: ExamAttendanceRow[] }>("/exam-attendance", {
      params: { exam_routine_id: examRoutineId, ...params },
    }),
  bulkMark: (payload: {
    exam_routine_id: number;
    entries: { exam_candidate_id: number; status: ExamAttendanceStatus; remarks?: string }[];
    mark_absent_by_default?: boolean;
  }) => api.post<{ success: boolean; data: { marked: number } }>("/exam-attendance/bulk", payload),
  update: (id: number, payload: { status?: ExamAttendanceStatus; remarks?: string }) =>
    api.put(`/exam-attendance/${id}`, payload),
  lock: (examRoutineId: number) => api.post("/exam-attendance/lock", { exam_routine_id: examRoutineId }),
  unlock: (examRoutineId: number) => api.post("/exam-attendance/unlock", { exam_routine_id: examRoutineId }),
};
