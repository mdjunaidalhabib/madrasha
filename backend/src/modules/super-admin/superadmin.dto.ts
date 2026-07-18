export interface CreateMadrasaRequestDto {
  name: string;
  address?: string;
  slug?: string;
  phone?: string;
  plan_id?: number | string;
  student_limit?: number | string;
  user_limit?: number | string;
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
  plan_id?: number | string;
  divisions?: unknown;
  modules?: unknown;
  classes?: unknown;
  books?: unknown;
}

export interface AssignPlanRequestDto {
  plan_id: number | string;
}

export interface CreateMadrasaUserRequestDto {
  name: string;
  email: string;
  password: string;
  role_id: number | string;
}
