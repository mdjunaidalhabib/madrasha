export interface BulkMarkExamAttendanceEntry {
  exam_candidate_id: number | string;
  status: string;
  remarks?: string;
}

export interface BulkMarkExamAttendanceRequestDto {
  exam_routine_id: number | string;
  entries: BulkMarkExamAttendanceEntry[];
  mark_absent_by_default?: boolean;
}

export interface UpdateExamAttendanceRequestDto {
  status?: string;
  remarks?: string;
}

export interface LockExamAttendanceRequestDto {
  exam_routine_id: number | string;
}
