export interface CreateExamRoomRequestDto {
  name: string;
  code: string;
  capacity?: number | string;
  floor?: string;
  location?: string;
  notes?: string;
}

export type UpdateExamRoomRequestDto = Partial<CreateExamRoomRequestDto> & {
  is_active?: boolean;
};
