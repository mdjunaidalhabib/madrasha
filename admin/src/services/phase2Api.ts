import api from "./api";

/**
 * Phase 2 API bindings: Student Fee Management + Student Account
 * Statement. Thin wrappers only, same pattern as phase1Api.ts.
 */

export type FeeFrequency = "ONE_TIME" | "MONTHLY" | "YEARLY";
export type FeeType = string;
export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "WAIVED";
export type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "BANK" | "ONLINE";

export interface FeeLinkableExam {
  id: number;
  name: string;
  year: string;
}

export const feeStructureApi = {
  list: (params?: { class_id?: number; session_id?: number; academic_year?: string }) =>
    api.get("/fee-structures", { params }),
  // যুক্ত পরীক্ষা" পিকারের জন্য - fee.read দিয়েই কাজ করে, exam.read লাগে না
  // (দেখুন backend FeeRepository.findExamsForTenant)।
  listExams: () => api.get("/fee-structures/exams"),
  create: (payload: {
    class_id?: number;
    name: string;
    amount: number;
    frequency: FeeFrequency;
    fee_type?: FeeType;
    session_id: number;
    // নির্দিষ্ট কোনো পরীক্ষার সাথে যুক্ত করলে - দেখুন FeeStructure.examId।
    exam_id?: number;
  }) => api.post("/fee-structures", payload),
  update: (id: number, payload: Record<string, unknown>) =>
    api.put(`/fee-structures/${id}`, payload),
  remove: (id: number) => api.delete(`/fee-structures/${id}`),
};

/* ================= পরীক্ষার ফি (exam × class table) ================= */
// পরীক্ষার ফি আর হাতে পরীক্ষা বাছাই করে তৈরি করতে হয় না - প্রতিটি পরীক্ষা তার
// বিভাগের প্রতিটি শ্রেণির জন্য নিজে থেকেই একটা করে ফি সারি পায় (দেখুন backend
// ExamFeeService); এখান থেকে শুধু পরিমাণ বসানো/বদলানো হয়।

export interface ExamFeeCell {
  class_id: number;
  structure_id: number | null;
  amount: number | null;
  is_active: boolean;
  invoice_count: number;
}

export interface ExamFeeExam {
  id: number;
  name: string;
  year: string;
  is_active: boolean;
  fee_active: boolean;
  division_ids: number[];
  legacy_all_classes_amount: number | null;
  cells: ExamFeeCell[];
}

export interface ExamFeeOverview {
  classes: { class_id: number; class_name_bn: string | null; division_id: number; division_name_bn: string | null }[];
  exams: ExamFeeExam[];
}

export const examFeeApi = {
  overview: () => api.get<{ success: boolean; data: ExamFeeOverview }>("/fee-structures/exam-fees"),
  /** amount null/0 = remove that class's fee for the exam. */
  setAmounts: (examId: number, amounts: { class_id: number; amount: number | null }[]) =>
    api.put<{
      success: boolean;
      data: { created: number; updated: number; removed: number; invoicesCreated: number };
    }>(`/fee-structures/exam-fees/${examId}`, { amounts }),
  /** ইহতেমাম's per-exam fee switch. On is refused while the exam itself is
   * off; switching on bills every student and texts guardians. */
  setStatus: (examId: number, isActive: boolean) =>
    api.patch<{
      success: boolean;
      data: {
        fee_active: boolean;
        switchedOff: number;
        invoicesRemoved: number;
        invoicesKept: number;
        invoicesCreated: number;
        studentsNotified: number;
      };
    }>(`/fee-structures/exam-fees/${examId}/status`, { is_active: isActive }),
};

/* ================= পরীক্ষার ফি — শ্রেণিভিত্তিক একসাথে গ্রহণ ================= */
// এক শ্রেণির বহু ছাত্রের পরীক্ষার ফি (সম্পূর্ণ বাকি) এক ক্লিকে গ্রহণ করার জন্য।

export interface ExamFeeCollectRow {
  invoice_id: number;
  student_id: number;
  name_bn: string;
  roll: number | null;
  amount: number;
  paid: number;
  waived: number;
  due: number;
  status: InvoiceStatus;
}

export interface ExamFeeCollectSheet {
  exam: { id: number; name: string; year: string };
  class: { id: number; name_bn: string };
  rows: ExamFeeCollectRow[];
  paid_count: number;
  totals: { due: number };
}

export interface ExamFeeBulkPayPayload {
  exam_id: number;
  class_id: number;
  invoice_ids: number[];
  method: PaymentMethod;
  payment_method_setting_id?: number;
  transaction_ref?: string;
  note?: string;
  paid_at?: string;
  notify_guardian: boolean;
}

export interface ExamFeeBulkPayResult {
  succeeded: { invoice_id: number; student_id: number; amount: number; payment_id: number }[];
  failed: { invoice_id: number; student_id: number; name_bn: string; reason: string }[];
  total_collected: number;
}

export const examFeeCollectApi = {
  /** Same exam × class overview as examFeeApi.overview, gated on fee.collect_payment. */
  options: () => api.get<{ success: boolean; data: ExamFeeOverview }>("/invoices/exam-fee/options"),
  getSheet: (examId: number, classId: number) =>
    api.get<{ success: boolean; data: ExamFeeCollectSheet }>("/invoices/exam-fee/collect-sheet", {
      params: { exam_id: examId, class_id: classId },
    }),
  bulkPay: (payload: ExamFeeBulkPayPayload) =>
    api.post<{ success: boolean; data: ExamFeeBulkPayResult }>("/invoices/exam-fee/bulk-pay", payload),
};

/* ================= FEE CATEGORY SETTINGS (ফি ধরণ সেটিংস) ================= */
// ফি স্ট্রাকচারের "ফি ধরণ" এখন আর হার্ডকোডেড enum নয় - ট্যানেন্ট নিজে যোগ/এডিট/
// ডিলিট করতে পারে, ফান্ড ও খাত সেটিংসের মতোই (তবে flat, কোনো nesting ছাড়া)।

export interface FeeCategoryItem {
  id: number;
  name: string;
  isAdmissionType: boolean;
  sortOrder: number;
  isActive: boolean;
}

export const feeCategoryApi = {
  list: () => api.get("/fee-categories"),
  create: (payload: { name: string; is_admission_type?: boolean }) =>
    api.post("/fee-categories", payload),
  update: (
    id: number,
    payload: { name?: string; is_admission_type?: boolean; sort_order?: number; is_active?: boolean },
  ) => api.patch(`/fee-categories/${id}`, payload),
  remove: (id: number) => api.delete(`/fee-categories/${id}`),
};

export const invoiceApi = {
  list: (params: { student_id?: number; status?: InvoiceStatus; month?: string }) =>
    api.get("/invoices", { params }),

  pending: (params?: { limit?: number; offset?: number }) =>
    api.get("/invoices/pending", { params }),

  // Grouped-per-student overdue fee summary (every fee type) for the
  // dedicated "বকেয়া ফী" management page.
  overdue: (params?: { search?: string; class_id?: number }) =>
    api.get("/invoices/overdue", { params }),

  // "সব ক্লিয়ার করুন" - hides every row currently on the pending queue (for
  // every office user); the invoices themselves stay collectible from ছাত্র
  // ফি গ্রহণ (see backend FeeRepository.clearPendingInvoices).
  clearPending: () => api.post("/invoices/pending/clear"),

  backfill: (payload?: { class_id?: number; session_id?: number }) =>
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

  waive: (invoiceId: number, payload: { amount: number; reason: string; mode?: "add" | "set" }) =>
    api.post(`/invoices/${invoiceId}/waive`, payload),
};

/* ================= PRE-APPROVAL FEE PREVIEW & DISCOUNTS ================= */

// একজন পেন্ডিং আবেদনকারীর শ্রেণির জন্য নির্ধারিত ফি তালিকা - approve করার আগে
// কোনো Invoice তৈরিই হয় না, তাই এটা FeeStructure থেকে সরাসরি প্রজেক্টেড।
export interface FeePreviewRow {
  feeStructureId: number;
  name: string;
  feeType: FeeType;
  frequency: FeeFrequency;
  amount: number;
  waivedAmount: number;
  reason: string | null;
  // নির্দিষ্ট কোনো পরীক্ষার সাথে যুক্ত পরীক্ষার ফি - এটা ভর্তি অনুমোদনের সাথে সাথে
  // বিল হয় না, শুধু তথ্যের জন্য দেখানো হয় (দেখুন FeeStructure.examId)।
  examLinked?: boolean;
}

export const studentFeeDiscountApi = {
  preview: (studentId: number) => api.get(`/students/${studentId}/fee-preview`),
  // amount: 0 দিলে ছাড়টা সরিয়ে দেয়। শুধু PENDING ভর্তির জন্য প্রযোজ্য - approve
  // হওয়া ছাত্রের জন্য বিদ্যমান invoiceApi.waive ব্যবহার হয়।
  setDiscount: (studentId: number, feeStructureId: number, payload: { amount: number; reason?: string }) =>
    api.put(`/students/${studentId}/fee-preview/${feeStructureId}`, payload),
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

  list: (params: { month?: string; year?: string; teacher_id?: number; status?: PayrollStatus }) =>
    api.get("/payroll", { params }),

  markPaid: (id: number, payload: { fund: string; category: string; transaction_ref?: string }) =>
    api.patch(`/payroll/${id}/pay`, payload),
};

/* ================= LIBRARY MANAGEMENT ================= */

export type LibraryBorrowStatus = "BORROWED" | "RETURNED" | "LOST";

export const libraryCategoryApi = {
  list: () => api.get("/library/categories"),
  create: (payload: { name: string }) => api.post("/library/categories", payload),
  update: (id: number, payload: { name: string }) => api.put(`/library/categories/${id}`, payload),
  remove: (id: number) => api.delete(`/library/categories/${id}`),
};

export const libraryBookApi = {
  list: (params?: { category_id?: number; q?: string; available_only?: boolean }) =>
    api.get("/library/books", { params }),
  get: (id: number) => api.get(`/library/books/${id}`),
  create: (payload: Record<string, unknown>) => api.post("/library/books", payload),
  update: (id: number, payload: Record<string, unknown>) => api.put(`/library/books/${id}`, payload),
  remove: (id: number) => api.delete(`/library/books/${id}`),
};

export const libraryBorrowApi = {
  list: (params?: {
    status?: LibraryBorrowStatus;
    overdue_only?: boolean;
    unsettled_fine_only?: boolean;
    student_id?: number;
    teacher_id?: number;
    book_id?: number;
  }) => api.get("/library/borrow-records", { params }),
  issue: (payload: {
    book_id: number;
    student_id?: number;
    teacher_id?: number;
    due_date?: string;
    notes?: string;
  }) => api.post("/library/borrow-records", payload),
  return: (id: number, payload?: { notes?: string }) =>
    api.post(`/library/borrow-records/${id}/return`, payload || {}),
  markLost: (id: number, payload?: { notes?: string }) =>
    api.post(`/library/borrow-records/${id}/mark-lost`, payload || {}),
  settleFine: (id: number) => api.post(`/library/borrow-records/${id}/settle-fine`, {}),
};

export const librarySettingsApi = {
  getFinePerDay: () => api.get("/library/settings/fine-per-day"),
  setFinePerDay: (value: number) => api.post("/library/settings/fine-per-day", { value }),
};
