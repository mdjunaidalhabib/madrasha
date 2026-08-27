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
  year?: string; // "YYYY" - filters to every month in that year, for the salary-register report
  teacher_id?: string;
  status?: string;
}

export interface MarkPayrollPaidRequestDto {
  transaction_ref?: string;
  // যে ফান্ড/খাতে খরচ যুক্ত হবে - ফান্ড ও খাত সেটিংসে (AccountFund/
  // AccountCategory) বাস্তবে যা আছে তা থেকেই নির্বাচিত, হার্ডকোড করা কোনো
  // ডিফল্ট নয়।
  fund: string;
  category: string;
}
