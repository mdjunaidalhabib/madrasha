export interface AssignInvigilatorRequestDto {
  exam_routine_id: number | string;
  invigilator_type: string;
  invigilator_id: number | string;
  role?: string;
  notes?: string;
}
