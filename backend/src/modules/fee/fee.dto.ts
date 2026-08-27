export interface CreateFeeStructureRequestDto {
  class_id?: number | string;
  name: string;
  amount: number | string;
  frequency: string;
  /** ADMISSION / TUITION / EXAM / BOARDING / OTHER - defaults to OTHER when omitted. */
  fee_type?: string;
  session_id?: number | string;
  /** @deprecated legacy fallback - resolved to a Session by matching name when session_id is absent. */
  academic_year?: string;
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

export interface DeleteAllInvoicesRequestDto {
  /** Must be exactly "DELETE" - a typed confirmation gate for this
   * irreversible, tenant-wide action (see fee.service.ts deleteAllInvoices). */
  confirm: string;
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
