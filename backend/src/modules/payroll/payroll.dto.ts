export interface TeacherOverrideDto {
  teacher_id: number | string;
  basic_salary?: number | string; // overrides Teacher.salary for this run
  allowances?: number | string;
  deductions?: number | string;
}

export interface GeneratePayrollRequestDto {
  month: string; // "YYYY-MM"
  overrides?: TeacherOverrideDto[]; // optional per-teacher adjustments
}

export interface PayrollQueryDto {
  month?: string;
  teacher_id?: string;
  status?: string;
}

export interface MarkPayrollPaidRequestDto {
  transaction_ref?: string;
}
