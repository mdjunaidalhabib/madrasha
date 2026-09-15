export interface CreateFeeStructureRequestDto {
  class_id?: number | string;
  name: string;
  amount: number | string;
  frequency: string;
  /** Free-text ফি ধরণ name, from the tenant's own FeeCategory picklist (see
   * fee-categories.* below) - defaults to "অন্যান্য" when omitted. */
  fee_type?: string;
  session_id?: number | string;
  /** @deprecated legacy fallback - resolved to a Session by matching name when session_id is absent. */
  academic_year?: string;
  /** Links this structure to one specific Exam (পরীক্ষার ফি only) - see
   * FeeStructure.examId. Pass "" or 0 on update to clear it. */
  exam_id?: number | string | null;
}

export type UpdateFeeStructureRequestDto = Partial<CreateFeeStructureRequestDto> & {
  is_active?: boolean;
};

export interface InvoiceQueryDto {
  student_id?: string;
  status?: string;
  month?: string;
}

export interface PendingInvoicesQueryDto {
  limit?: number | string;
  offset?: number | string;
}

export interface OverdueFeesQueryDto {
  /// Matches student name (contains) or roll/registration no (exact).
  search?: string;
  class_id?: number | string;
}

export interface WaiveInvoiceRequestDto {
  amount: number | string;
  reason: string;
  /** "add" (default) tops up the existing waived amount by `amount`, for
   * incremental waiving. "set" replaces it outright with `amount` - used to
   * edit an already-recorded waiver (e.g. এহতেমাম correcting a mistake
   * after fully waiving an admission fee). */
  mode?: "add" | "set";
}

export interface SetStudentFeeDiscountRequestDto {
  /** 0 removes the standing discount for this fee structure. */
  amount: number | string;
  /** Required when amount > 0. */
  reason?: string;
}

export interface RecordPaymentRequestDto {
  amount: number | string;
  method: string;
  transaction_ref?: string;
  /// Which admin-configured manual payment method was used (optional).
  payment_method_setting_id?: number | string;
  note?: string;
  /// Backdate the payment (e.g. cash collected yesterday, entered today).
  /// Defaults to now when omitted.
  paid_at?: string;
}

/* ================= ফি ধরণ ব্যবস্থাপনা (settings CRUD) ================= */

export interface CreateFeeCategoryRequestDto {
  name: string;
  is_admission_type?: boolean;
}

export interface UpdateFeeCategoryRequestDto {
  name?: string;
  is_admission_type?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

/* ================= MANUAL PAYMENT METHOD SETUP ================= */

export interface CreatePaymentMethodSettingRequestDto {
  method_type: string; // CASH / BKASH / NAGAD / BANK / OTHER
  label: string;
  account_name?: string;
  account_number?: string;
  bank_name?: string;
  branch?: string;
  instructions?: string;
}

export type UpdatePaymentMethodSettingRequestDto = Partial<CreatePaymentMethodSettingRequestDto> & {
  is_active?: boolean;
};
