export interface CreateCategoryRequestDto {
  name: string;
}

export type UpdateCategoryRequestDto = Partial<CreateCategoryRequestDto>;

export interface CreateBookRequestDto {
  title: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  category_id?: number | string;
  shelf_location?: string;
  copies_total?: number | string;
}

export type UpdateBookRequestDto = Partial<CreateBookRequestDto> & {
  is_active?: boolean;
};

export interface BookQueryDto {
  category_id?: string;
  q?: string;
  available_only?: string;
}

export interface IssueBookRequestDto {
  book_id: number | string;
  student_id?: number | string;
  teacher_id?: number | string;
  due_date?: string;
  notes?: string;
}

export interface ReturnBookRequestDto {
  notes?: string;
}

export interface BorrowRecordQueryDto {
  status?: string;
  overdue_only?: string;
  student_id?: string;
  teacher_id?: string;
  book_id?: string;
  unsettled_fine_only?: string;
  limit?: number | string;
  offset?: number | string;
}

export interface UpdateFinePerDayRequestDto {
  value: number | string;
}
