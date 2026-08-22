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
  mobile?: string;
  photo_url?: string;
}

export interface ResetPasswordRequestDto {
  password: string;
}
