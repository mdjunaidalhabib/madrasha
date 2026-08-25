export interface CreateImportantLinkRequestDto {
  label: string;
  sub_label?: string | null;
  url: string;
}

export type UpdateImportantLinkRequestDto = Partial<CreateImportantLinkRequestDto> & {
  is_active?: boolean;
};

export interface ReorderImportantLinksRequestDto {
  link_ids: (number | string)[];
}
