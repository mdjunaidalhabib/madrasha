export interface CreateSessionRequestDto {
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  division_id?: number | string | null;
}

// isActive is never settable through a generic update - becoming "the"
// active session for a division only happens through the dedicated
// set-current transaction (see SessionService.setCurrent), which also
// unsets whichever session was active before it.
export type UpdateSessionRequestDto = Omit<Partial<CreateSessionRequestDto>, "is_active">;
