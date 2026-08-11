export interface CreateFeeStructureRequestDto {
  class_id?: number | string;
  name: string;
  amount: number | string;
  frequency: string;
  academic_year: string;
}

export type UpdateFeeStructureRequestDto = Partial<CreateFeeStructureRequestDto> & {
  is_active?: boolean;
};

export interface GenerateInvoicesRequestDto {
  fee_structure_id: number | string;
  due_date: string;
  month?: string; // required when the fee structure is MONTHLY, "YYYY-MM"
  class_id?: number | string; // overrides the fee structure's class if given
  academic_year?: string; // which students to bill; defaults to the fee structure's year
}

export interface InvoiceQueryDto {
  student_id?: string;
  status?: string;
  month?: string;
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
