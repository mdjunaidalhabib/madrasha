export interface SaveAssignmentRequestDto {
  teacher_id: number;
  class_id: number;
  book_ids?: number[];
}

export type UpdateAssignmentRequestDto = SaveAssignmentRequestDto;

export interface DeleteAssignmentRequestDto {
  teacher_id: number;
  class_id: number;
}
