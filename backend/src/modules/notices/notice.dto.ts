export interface CreateNoticeRequestDto {
  title: string;
  body: string;
}

export type UpdateNoticeRequestDto = Partial<CreateNoticeRequestDto>;
