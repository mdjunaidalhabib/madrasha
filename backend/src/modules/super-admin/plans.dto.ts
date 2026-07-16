export interface CreatePlanRequestDto {
  name: string;
  student_limit?: number | string;
  user_limit?: number | string;
  duration_days?: number | string;
  price?: number | string;
  is_active?: unknown;
}

export type UpdatePlanRequestDto = CreatePlanRequestDto;

export interface ListPlansQueryDto {
  q?: string;
  active?: string;
}
