import type { InstitutionType, Lang } from "@madrasha/shared-ui/src/i18n";

export type UserRole = "muhtamim" | "talimat" | "accountant";

export type DefaultUserType = {
  role: UserRole;
  name: string;
  email: string;
  password: string;
};

export type CreateMadrasaPayload = {
  /* ========================
  Madrasa Info
  ======================== */
  name: string;
  slug?: string;
  address?: string;
  phone?: string;
  institution_type: InstitutionType;
  /** null = the institution type's own default language. */
  default_language: Lang | null;

  /* ========================
  Plan
  ======================== */
  plan_id: number;
  student_limit: number;
  user_limit: number;
  duration_days: number;
  start_date: string;

  /* ========================
  System Setup
  ======================== */
  divisions: number[];
  modules: number[];
  classes: number[];
  books: number[];

  /* ========================
  Default Users
  ======================== */
  default_users: DefaultUserType[];
};
