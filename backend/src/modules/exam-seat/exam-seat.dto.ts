export interface AutoAllocateSeatsRequestDto {
  exam_routine_id: number | string;
  room_ids: (number | string)[];
  strategy?: string;
  preserve_manual_overrides?: boolean;
}

export interface ManualSeatAdjustRequestDto {
  room_id: number | string;
  seat_no: string;
  row_no?: number | string;
  column_no?: number | string;
}
