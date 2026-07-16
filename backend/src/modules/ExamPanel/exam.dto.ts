export interface CreateExamRequestDto {
  name: string;
  year: string | number;
}

export interface SaveGradeRequestDto {
  name: string;
  min_mark: number | string;
  max_mark: number | string;
}

export interface UpdateFailMarkRequestDto {
  value: number | string;
}
