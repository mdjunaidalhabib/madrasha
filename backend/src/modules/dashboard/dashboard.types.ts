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
}
