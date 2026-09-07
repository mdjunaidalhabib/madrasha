export interface TodayTotalsRow {
  income: number | null;
  expense: number | null;
}

export interface FundBalanceRow {
  fund: string;
  balance: number;
}

export interface PaymentMethodTotalRow {
  payment_method: string | null;
  income: number;
  expense: number;
}

export interface RecentTransactionRow {
  id: number;
  type: string;
  amount: number;
  fund: string;
  category: string | null;
  paymentMethod: string | null;
  receiptNo: string | null;
  voucherNo: string | null;
  donorName: string | null;
  receiverName: string | null;
  address: string | null;
  mobile: string | null;
  note: string | null;
  entryDate: Date;
  entryTime: Date | null;
}

export interface AttendanceTodaySummary {
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
  percentage: number;
}

export interface OverdueFeeListItem {
  studentId: number;
  studentName: string;
  invoiceCount: number;
  oldestDueDate: Date;
  remaining: number;
}

export interface OverdueFeesSummary {
  /** Total unpaid invoices across every student (kept for backward compat). */
  count: number;
  /** Distinct students with at least one overdue invoice. */
  studentCount: number;
  totalDue: number;
  list: OverdueFeeListItem[];
}

export interface StudentGenderBreakdown {
  male: number;
  female: number;
  unspecified: number;
}

export interface ImportantLinkRow {
  id: number;
  label: string;
  subLabel: string | null;
  url: string;
}

export interface UpcomingExamRow {
  id: number;
  examName: string;
  className: string;
  subject: string;
  examDate: Date;
  startTime: string;
  endTime: string;
}

export interface IncomeExpenseTrendRow {
  period: string;
  total_income: number | null;
  total_expense: number | null;
}

export interface AttendanceTrendRow {
  period: string;
  present: number;
  total: number;
}

export interface IncomeExpenseTrendPoint {
  period: string;
  total_income: number;
  total_expense: number;
}

export interface AttendanceTrendPoint {
  period: string;
  percentage: number;
}

export interface DashboardTrends {
  incomeExpense: IncomeExpenseTrendPoint[];
  attendance: AttendanceTrendPoint[];
}

export interface DashboardSummary {
  students: number;
  teachers: number;
  users: number;
  income: number;
  expense: number;
  balance: number;
  todayIncome: number;
  todayExpense: number;
  fundBalances: FundBalanceRow[];
  paymentMethodTotals: PaymentMethodTotalRow[];
  recentTransactions: RecentTransactionRow[];
  studentsByGender: StudentGenderBreakdown;
  attendanceToday: AttendanceTodaySummary;
  pendingAdmissionsCount: number;
  overdueFees: OverdueFeesSummary;
  upcomingExams: UpcomingExamRow[];
  importantLinks: ImportantLinkRow[];
}
