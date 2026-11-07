export interface CreatePlanRequestDto {
  name?: string;
  renewalPrice?: number | string | null;
  extraStudentPriceFirst?: number | string | null;
  extraStudentPriceRenewal?: number | string | null;
  sortOrder?: number | string;
  nameBn?: string | null;
  tagline?: string | null;
  taglineBn?: string | null;
  showOnLanding?: number | boolean;
  isFeatured?: number | boolean;
  accentColor?: string | null;
  renewal_price?: number | string | null;
  extra_student_price_first?: number | string | null;
  extra_student_price_renewal?: number | string | null;
  sort_order?: number | string;
  name_bn?: string | null;
  tagline_bn?: string | null;
  show_on_landing?: number | boolean;
  is_featured?: number | boolean;
  accent_color?: string | null;
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
