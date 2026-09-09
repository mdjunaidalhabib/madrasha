export interface CreateMadrasaRequestDto {
  name: string;
  address?: string;
  slug?: string;
  phone?: string;
  plan_id?: number | string;
  student_limit?: number | string;
  user_limit?: number | string;
  duration_days?: number | string;
  /** Plan's real start date (YYYY-MM-DD) - super admin can backdate this for
   * madrasas that were already subscribed before being entered into the
   * system. Defaults to today when omitted. */
  start_date?: string;
  divisions?: unknown;
  modules?: unknown;
  classes?: unknown;
  books?: unknown;
  default_users?: Array<{ role: string; name?: string; email: string; password: string }>;
}

export interface UpdateMadrasaRequestDto {
  name?: string;
  slug?: string;
  address?: string;
  phone?: string;
  student_limit?: number | string;
  user_limit?: number | string;
  is_active?: unknown;
  website_status?: string;
  /** Hostname only (no protocol/path), e.g. "www.example.com" - null/"" clears it. */
  custom_domain?: string | null;
  plan_id?: number | string;
  /** See CreateMadrasaRequestDto.start_date. */
  start_date?: string;
  divisions?: unknown;
  modules?: unknown;
  classes?: unknown;
  books?: unknown;
}

export interface AssignPlanRequestDto {
  plan_id: number | string;
  /** See CreateMadrasaRequestDto.start_date. */
  start_date?: string;
}

export interface CreateMadrasaUserRequestDto {
  name: string;
  email: string;
  password: string;
  role_id: number | string;
}

