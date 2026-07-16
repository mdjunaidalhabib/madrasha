import { dashboardRepository, DashboardRepository } from "./dashboard.repository";
import { DashboardSummary } from "./dashboard.types";

export class DashboardService {
  constructor(private readonly repository: DashboardRepository = dashboardRepository) {}

  async getSummary(madrasaId: number): Promise<DashboardSummary> {
    const [studentsCount, teachersCount, usersCount, incomeAgg, expenseAgg] = await Promise.all([
      this.repository.countActiveStudents(madrasaId),
      this.repository.countActiveTeachers(madrasaId),
      this.repository.countUsers(madrasaId),
      this.repository.sumAccountsByType(madrasaId, "income"),
      this.repository.sumAccountsByType(madrasaId, "expense"),
    ]);

    const today = await this.repository.findTodayTotals(madrasaId);
    const funds = await this.repository.findFundBalances(madrasaId);
    const recent = await this.repository.findRecentTransactions(madrasaId);

    const income = Number(incomeAgg._sum.amount || 0);
    const expense = Number(expenseAgg._sum.amount || 0);

    return {
      students: studentsCount,
      teachers: teachersCount,
      users: usersCount,
      income,
      expense,
      balance: income - expense,
      todayIncome: Number(today[0]?.income || 0),
      todayExpense: Number(today[0]?.expense || 0),
      fundBalances: funds,
      recentTransactions: recent,
    };
  }
}

export const dashboardService = new DashboardService();
