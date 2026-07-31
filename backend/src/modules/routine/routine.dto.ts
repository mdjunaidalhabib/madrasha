export interface CreateClassRoutineRequestDto {
  class_id: number | string;
  day_of_week: number | string;
  subject: string;
  teacher_id?: number | string;
  start_time: string;
  end_time: string;
}

export type UpdateClassRoutineRequestDto = Partial<CreateClassRoutineRequestDto>;

export interface CreateExamRoutineRequestDto {
  exam_id: number | string;
  class_id: number | string;
  subject: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room_no?: string;
}

export type UpdateExamRoutineRequestDto = Partial<CreateExamRoutineRequestDto>;
