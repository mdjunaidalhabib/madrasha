export interface CreateSessionRequestDto {
  name?: string;
  start_time?: string | null;
  end_time?: string | null;
  residential_only?: boolean | string | number;
  sort_order?: number | string;
  is_active?: boolean | string | number;
}

export type UpdateSessionRequestDto = CreateSessionRequestDto;

export interface SessionListQueryDto {
  include_inactive?: string;
}

export interface SessionSheetQueryDto {
  session_id?: string;
  date?: string;
  class_id?: string;
}

export interface SessionMarkEntryDto {
  student_id: number | string;
  status: string;
  remarks?: string | null;
}

export interface SessionMarkRequestDto {
  session_id?: number | string;
  date?: string;
  class_id?: number | string | null;
  entries?: SessionMarkEntryDto[];
}

export interface SessionReportQueryDto {
  from?: string;
  to?: string;
  class_id?: string;
  session_id?: string;
}
