export interface CreateSessionRequestDto {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export type UpdateSessionRequestDto = Partial<CreateSessionRequestDto> & {
  is_active?: boolean;
};
