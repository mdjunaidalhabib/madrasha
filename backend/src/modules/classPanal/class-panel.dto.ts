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
}

export interface UpdateMiyariSubjectsRequestDto {
  class_id: number | string;
  book_ids: Array<number | string>;
}
