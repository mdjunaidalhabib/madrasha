export interface CreateUserRequestDto {
  name: string;
  email: string;
  password: string;
  role_id: number;
}

export interface UpdateUserRequestDto {
  role_id?: number;
  is_active?: boolean;
  name?: string;
}
