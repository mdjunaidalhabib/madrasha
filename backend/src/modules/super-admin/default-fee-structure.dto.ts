export interface CreateDefaultFeeStructureRequestDto {
  class_id?: number | string | null;
  name: string;
  amount: number | string;
  frequency: string;
}

export type UpdateDefaultFeeStructureRequestDto = Partial<CreateDefaultFeeStructureRequestDto> & {
  is_active?: boolean;
};
