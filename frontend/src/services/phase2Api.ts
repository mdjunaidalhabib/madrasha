import api from "./api";

/**
 * Phase 2 API bindings: Student Fee Management + Student Account
 * Statement. Thin wrappers only, same pattern as phase1Api.ts.
 */

export type FeeFrequency = "ONE_TIME" | "MONTHLY" | "YEARLY";
export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "WAIVED";
export type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "BANK" | "ONLINE";

export const feeStructureApi = {
  list: (params?: { class_id?: number; academic_year?: string }) =>
    api.get("/fee-structures", { params }),
  create: (payload: {
    class_id?: number;
    name: string;
    amount: number;
    frequency: FeeFrequency;
    academic_year: string;
  }) => api.post("/fee-structures", payload),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put(`/fee-structures/${id}`, payload),
  remove: (id: number) => api.delete(`/fee-structures/${id}`),
};

export const invoiceApi = {
  generate: (payload: {
    fee_structure_id: number;
    due_date: string;
    month?: string;
    class_id?: number;
    academic_year?: string;
  }) => api.post("/invoices/generate", payload),

  list: (params: { student_id?: number; status?: InvoiceStatus; month?: string }) =>
    api.get("/invoices", { params }),

  backfill: (payload?: { class_id?: number; academic_year?: string }) =>
    api.post("/invoices/backfill", payload || {}),

  pay: (
    invoiceId: number,
    payload: {
      amount: number;
      method: PaymentMethod;
      transaction_ref?: string;
      payment_method_setting_id?: number;
      note?: string;
      paid_at?: string;
    },
  ) => api.post(`/invoices/${invoiceId}/pay`, payload),

  waive: (invoiceId: number, payload: { amount: number; reason: string }) =>
    api.post(`/invoices/${invoiceId}/waive`, payload),
};

/* ================= MANUAL PAYMENT METHOD SETUP (admin panel) ================= */

export type PaymentMethodType = "CASH" | "BKASH" | "NAGAD" | "BANK" | "OTHER";

export interface PaymentMethodSetting {
  id: number;
  methodType: PaymentMethodType;
  label: string;
  accountName?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  branch?: string | null;
  instructions?: string | null;
  isActive: boolean;
}

export const paymentMethodSettingApi = {
  list: (activeOnly?: boolean) =>
    api.get("/payment-methods", { params: activeOnly ? { active_only: "true" } : {} }),
  create: (payload: {
    method_type: PaymentMethodType;
    label: string;
    account_name?: string;
    account_number?: string;
    bank_name?: string;
    branch?: string;
    instructions?: string;
  }) => api.post("/payment-methods", payload),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put(`/payment-methods/${id}`, payload),
  remove: (id: number) => api.delete(`/payment-methods/${id}`),
};

export const studentStatementApi = {
  get: (studentId: number) => api.get(`/students/${studentId}/statement`),
};

/* ================= SALARY & PAYROLL ================= */

export type PayrollStatus = "PENDING" | "PAID";

export const payrollApi = {
  generate: (payload: {
    month: string;
    overrides?: Array<{
      teacher_id: number;
      basic_salary?: number;
      allowances?: number;
      deductions?: number;
    }>;
  }) => api.post("/payroll/generate", payload),

  list: (params: { month?: string; teacher_id?: number; status?: PayrollStatus }) =>
    api.get("/payroll", { params }),

  markPaid: (id: number, payload?: { transaction_ref?: string }) =>
    api.patch(`/payroll/${id}/pay`, payload || {}),
};
