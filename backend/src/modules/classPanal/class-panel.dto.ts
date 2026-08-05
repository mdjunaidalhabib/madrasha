export interface AddClassRequestDto {
  division_id: number | string;
  name_bn: string;
}

export interface UpdateClassRequestDto {
  name_bn: string;
}

export interface AddSubjectRequestDto {
  class_id: number | string;
  name_bn: string;
}

export interface UpdateSubjectRequestDto {
  name_bn: string;
  full_marks?: number | string;
}

export interface UpdateMiyariSubjectsRequestDto {
  class_id: number | string;
  book_ids: Array<number | string>;
}

export interface ReorderSubjectsRequestDto {
  class_id: number | string;
  book_ids: Array<number | string>;
}

export interface ReorderClassesRequestDto {
  division_id: number | string;
  class_ids: Array<number | string>;
}
