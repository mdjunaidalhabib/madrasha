export interface CreateExamRequestDto {
  name: string;
  exam_type?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  /** বিভাগভিত্তিক scope; empty/omitted = সকল বিভাগ. */
  division_ids?: number[];
}

export interface UpdateExamRequestDto {
  name?: string;
  is_active?: boolean;
  exam_type?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  /** Omitted = keep the current scope; [] = সকল বিভাগ. */
  division_ids?: number[];
}

export interface SaveGradeRequestDto {
  name: string;
  min_mark: number | string;
  max_mark: number | string;
  point?: number | string;
  /** Grade scope on create: null/omitted = madrasa-wide default scale. */
  division_id?: number | string | null;
}

export interface UpdateFailMarkRequestDto {
  value: number | string;
}

export interface UpdateDivisionFailMarkRequestDto {
  /** null clears the division's override. */
  value: number | string | null;
}
