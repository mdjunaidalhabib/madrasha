export interface ListExamCandidatesQueryDto {
  exam_id: number | string;
  class_id?: number | string;
  division_id?: number | string;
  status?: string;
  eligibility_status?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface EligibleStudentsQueryDto {
  exam_id: number | string;
  class_id?: number | string;
  division_id?: number | string;
  search?: string;
}

export interface RegisterCandidateRequestDto {
  exam_id: number | string;
  student_id: number | string;
  notes?: string;
}

export interface BulkRegisterRequestDto {
  exam_id: number | string;
  student_ids?: Array<number | string>;
  class_id?: number | string;
  division_id?: number | string;
}

export interface EligibilityCheckRequestDto {
  exam_id?: number | string;
  student_id?: number | string;
  candidate_id?: number | string;
}

export interface BulkEligibilityCheckRequestDto {
  exam_id: number | string;
  candidate_ids?: Array<number | string>;
}

export interface UpdateCandidateStatusRequestDto {
  status: string;
  notes?: string;
}

export interface BulkUpdateStatusRequestDto {
  ids: Array<number | string>;
  status: string;
  notes?: string;
}

export interface UpdateEligibilitySettingsRequestDto {
  require_active_student?: boolean;
  require_approved_admission?: boolean;
  check_dues?: boolean;
  check_attendance?: boolean;
  min_attendance_percent?: number | string;
}
