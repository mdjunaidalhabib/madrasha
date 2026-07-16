export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface UnlockRequestDto {
  password: string;
}

export type { LoginResult as LoginResponseDto } from "./auth.types";
