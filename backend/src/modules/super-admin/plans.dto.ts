export interface CreatePlanRequestDto {
  name: string;
  student_limit?: number | string;
  user_limit?: number | string;
  duration_days?: number | string;
  price?: number | string;
  is_active?: unknown;
  /** Per-বিভাগ registration-number block size for each class (e.g. নূরানী
   * 30, হিফজ 40, কিতাব 20). Omitted = leave the plan's sizes unchanged;
   * a size of 0/empty = no automatic block for that বিভাগ. */
  reg_block_sizes?: Array<{ division_id: number | string; block_size: number | string | null }>;
}

export type UpdatePlanRequestDto = CreatePlanRequestDto;

export interface ListPlansQueryDto {
  q?: string;
  active?: string;
}
