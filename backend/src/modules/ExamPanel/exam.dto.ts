export interface CreateExamRequestDto {
  name: string;
}

export interface UpdateExamRequestDto {
  name?: string;
  is_active?: boolean;
}

export interface SaveGradeRequestDto {
  name: string;
  min_mark: number | string;
  max_mark: number | string;
  point?: number | string;
}

export interface UpdateFailMarkRequestDto {
  value: number | string;
}
