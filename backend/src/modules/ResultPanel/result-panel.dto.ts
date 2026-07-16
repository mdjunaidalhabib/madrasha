export interface CreateSessionRequestDto {
  exam_id: number | string;
  class_id: number | string;
}

export interface MarkRowDto {
  student_id: number | string;
  exam_id: number | string;
  class_id: number | string;
  book_id: number | string;
  mark: number | string;
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
