export interface CreateSessionRequestDto {
  exam_id: number | string;
  class_id: number | string;
}

export interface MarkComponentValueDto {
  component: string; // MarkComponentType member, e.g. "WRITTEN" | "MCQ" | ...
  value: number | string | null;
}

export interface MarkRowDto {
  student_id: number | string;
  exam_id: number | string;
  class_id: number | string;
  book_id: number | string;
  // null/undefined/"" means "clear this mark" — the row is deleted rather
  // than upserted (see ResultPanelService.saveMarks).
  mark: number | string | null;
  // True when the student did not sit this subject's exam. `mark` is still
  // sent as 0 alongside this so the average calculation keeps counting the
  // subject (see ResultPanelService.rebuildResultSummary).
  is_absent?: boolean;
  // Exempted from this subject (e.g. medical/administrative waiver) - server
  // forces `mark` to 0 regardless of what's sent, same as is_absent.
  is_exempted?: boolean;
  // Result withheld for this subject pending an administrative hold -
  // server forces `mark` to 0 regardless of what's sent.
  is_withheld?: boolean;
  note?: string | null;
  // Present only for subjects with a configured MarkComponentConfig
  // breakdown - when present, `mark` is ignored and recomputed server-side
  // as the sum of these component values (see saveMarks).
  components?: MarkComponentValueDto[];
}

export interface SaveMarksRequestDto {
  result_master_id?: number | string;
  data: MarkRowDto[];
}

export interface ProcessResultRequestDto {
  exam_id: number | string;
  class_id: number | string;
  result_master_id?: number | string;
}

export interface PublishResultRequestDto {
  result_master_id: number | string;
}
