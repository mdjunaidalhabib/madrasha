export type UserRole = "muhtamim" | "talimat" | "accountant";

export type DefaultUserType = {
  role: UserRole;
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

  /* ========================
  Plan
  ======================== */
  plan_id: number;
  student_limit: number;
  user_limit: number;

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
