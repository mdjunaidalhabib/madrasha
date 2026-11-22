import { resolveDashboardScope } from "./dashboard.scope";
import { buildPeriodExpr } from "../../shared/utils/period-expr.util";
import { dashboardRepository, DashboardRepository } from "./dashboard.repository";
import { DASHBOARD_TREND_DEFAULT_LIMIT, DASHBOARD_TREND_ROW_LIMIT } from "./dashboard.constants";
import { DashboardSummary, DashboardTrends } from "./dashboard.types";

const ACCOUNTS_DATE_COLUMN = "COALESCE(entry_date, CAST(created_at AS DATE))";
const ATTENDANCE_DATE_COLUMN = "date";

export class DashboardService {
  constructor(private readonly repository: DashboardRepository = dashboardRepository) {}

  async getSummary(madrasaId: number, selection = "active"): Promise<DashboardSummary> {
    const scope = resolveDashboardScope(
      await this.repository.findDashboardSessions(madrasaId),
      selection,
    );
    const [
      studentsCount,
      teachersCount,
      usersCount,
      incomeAgg,
      expenseAgg,
      today,
      funds,
      paymentMethodTotals,
      recent,
      genderGroups,
      attendanceCounts,
      pendingAdmissionsCount,
      overdueFees,
      upcomingExams,
      importantLinks,
      currentIncome,
      currentExpense,
    ] = await Promise.all([
      this.repository.countActiveStudents(madrasaId, scope),
      this.repository.countActiveTeachers(madrasaId),
      this.repository.countUsers(madrasaId),
      this.repository.sumAccountsByType(madrasaId, "income", scope),
      this.repository.sumAccountsByType(madrasaId, "expense", scope),
      this.repository.findTodayTotals(madrasaId, scope),
      this.repository.findFundBalances(madrasaId),
      this.repository.findPaymentMethodTotals(madrasaId, scope),
      this.repository.findRecentTransactions(madrasaId, scope),
      this.repository.countActiveStudentsByGender(madrasaId, scope),
      this.repository.findTodayStudentAttendanceCounts(madrasaId, scope),
      this.repository.countPendingAdmissions(madrasaId, scope),
      this.repository.findOverdueSummary(madrasaId, scope),
      this.repository.findUpcomingExams(madrasaId, scope),
      this.repository.findActiveImportantLinks(),
      this.repository.sumAccountsByType(madrasaId, "income"),
      this.repository.sumAccountsByType(madrasaId, "expense"),
    ]);

    const income = Number(incomeAgg._sum.amount || 0);
    const expense = Number(expenseAgg._sum.amount || 0);

    const studentsByGender = genderGroups.reduce(
      (acc, group) => {
        const count = group._count._all;
        if (group.gender === 1) acc.male += count;
        else if (group.gender === 2) acc.female += count;
        else acc.unspecified += count;
        return acc;
      },
      { male: 0, female: 0, unspecified: 0 },
    );

    const { PRESENT, ABSENT, LATE, LEAVE } = attendanceCounts;
    const attendanceTotal = PRESENT + ABSENT + LATE + LEAVE;
    const attendancePercentage =
      attendanceTotal > 0 ? Math.round(((PRESENT + LATE) / attendanceTotal) * 1000) / 10 : 0;

    return {
      sessionContext: {
        mode: scope.mode,
        sessions: scope.sessions,
        selectedSessionIds: scope.selected.map((s) => s.id),
      },
      currentBalance:
        Number(currentIncome._sum.amount || 0) - Number(currentExpense._sum.amount || 0),
      students: studentsCount,
      teachers: teachersCount,
      users: usersCount,
      income,
      expense,
      balance: income - expense,
      todayIncome: Number(today[0]?.income || 0),
      todayExpense: Number(today[0]?.expense || 0),
      fundBalances: funds,
      paymentMethodTotals: paymentMethodTotals.map((row) => ({
        payment_method: row.payment_method,
        income: Number(row.income || 0),
        expense: Number(row.expense || 0),
      })),
      recentTransactions: recent,
      studentsByGender,
      attendanceToday: {
        present: PRESENT,
        absent: ABSENT,
        late: LATE,
        leave: LEAVE,
        total: attendanceTotal,
        percentage: attendancePercentage,
      },
      pendingAdmissionsCount,
      overdueFees,
      upcomingExams,
      importantLinks: importantLinks.map((link) => ({
        id: link.id,
        label: link.label,
        subLabel: link.subLabel,
        url: link.url,
      })),
    };
  }

  async getTrends(
    madrasaId: number,
    groupBy: string,
    selection = "active",
  ): Promise<DashboardTrends> {
    const scope = resolveDashboardScope(
      await this.repository.findDashboardSessions(madrasaId),
      selection,
    );
    const limit = DASHBOARD_TREND_ROW_LIMIT[groupBy] ?? DASHBOARD_TREND_DEFAULT_LIMIT;
    const accountsPeriodExpr = buildPeriodExpr(groupBy, ACCOUNTS_DATE_COLUMN);
    const attendancePeriodExpr = buildPeriodExpr(groupBy, ATTENDANCE_DATE_COLUMN);

    const [incomeExpenseRows, attendanceRows] = await Promise.all([
      this.repository.findIncomeExpenseTrend(madrasaId, accountsPeriodExpr, limit, scope),
      this.repository.findAttendanceRateTrend(madrasaId, attendancePeriodExpr, limit, scope),
    ]);

    return {
      incomeExpense: incomeExpenseRows
        .map((row) => ({
          period: String(row.period),
          total_income: Number(row.total_income || 0),
          total_expense: Number(row.total_expense || 0),
        }))
        .reverse(),
      attendance: attendanceRows
        .map((row) => {
          const total = Number(row.total || 0);
          const present = Number(row.present || 0);
          return {
            period: String(row.period),
            percentage: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
          };
        })
        .reverse(),
    };
  }
}

export const dashboardService = new DashboardService();
