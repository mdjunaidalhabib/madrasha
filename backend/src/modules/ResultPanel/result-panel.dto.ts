export interface CreateSessionRequestDto {
  exam_id: number | string;
  class_id: number | string;
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
