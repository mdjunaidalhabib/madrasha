export interface CreateEventRequestDto {
  title: string;
  type?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  description?: string;
}

export type UpdateEventRequestDto = Partial<CreateEventRequestDto>;
