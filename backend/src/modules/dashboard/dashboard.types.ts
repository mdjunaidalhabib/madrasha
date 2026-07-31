export interface TodayTotalsRow {
  income: number | null;
  expense: number | null;
}

export interface FundBalanceRow {
  fund: string;
  balance: number;
}

export interface RecentTransactionRow {
  id: number;
  type: string;
  amount: number;
  fund: string;
  category: string | null;
  payment_method: string | null;
  entry_date: Date;
}

export interface AttendanceTodaySummary {
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
  percentage: number;
}

export interface OverdueFeesSummary {
  count: number;
  totalDue: number;
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
  recentTransactions: RecentTransactionRow[];
  attendanceToday: AttendanceTodaySummary;
  pendingAdmissionsCount: number;
  overdueFees: OverdueFeesSummary;
  upcomingExams: UpcomingExamRow[];
}
