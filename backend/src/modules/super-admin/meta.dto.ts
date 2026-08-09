export interface CreateDivisionRequestDto {
  name?: string;
  name_bn: string;
}

export type UpdateDivisionRequestDto = CreateDivisionRequestDto;

export interface CreateClassRequestDto {
  division_id: number | string;
  name?: string;
  name_bn: string;
}

export interface UpdateClassRequestDto {
  name?: string;
  name_bn: string;
}

export interface CreateBookRequestDto {
  class_id: number | string;
  name?: string;
  name_bn: string;
}

export interface UpdateBookRequestDto {
  name?: string;
  name_bn: string;
}

export interface ReorderDivisionsRequestDto {
  division_ids: (number | string)[];
}

export interface ReorderClassesRequestDto {
  division_id: number | string;
  class_ids: (number | string)[];
}

export interface ReorderBooksRequestDto {
  class_id: number | string;
  book_ids: (number | string)[];
}
