import { buildPeriodExpr } from "../../shared/utils/period-expr.util";
import { dashboardRepository, DashboardRepository } from "./dashboard.repository";
import {
  DASHBOARD_OVERDUE_FEES_LIST_LIMIT,
  DASHBOARD_TREND_DEFAULT_LIMIT,
  DASHBOARD_TREND_ROW_LIMIT,
} from "./dashboard.constants";
import { DashboardSummary, DashboardTrends } from "./dashboard.types";

const ACCOUNTS_DATE_COLUMN = "COALESCE(entry_date, CAST(created_at AS DATE))";
const ATTENDANCE_DATE_COLUMN = "date";

export class DashboardService {
  constructor(private readonly repository: DashboardRepository = dashboardRepository) {}

  async getSummary(madrasaId: number): Promise<DashboardSummary> {
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
      overdueInvoices,
      upcomingExams,
      importantLinks,
    ] = await Promise.all([
      this.repository.countActiveStudents(madrasaId),
      this.repository.countActiveTeachers(madrasaId),
      this.repository.countUsers(madrasaId),
      this.repository.sumAccountsByType(madrasaId, "income"),
      this.repository.sumAccountsByType(madrasaId, "expense"),
      this.repository.findTodayTotals(madrasaId),
      this.repository.findFundBalances(madrasaId),
      this.repository.findPaymentMethodTotals(madrasaId),
      this.repository.findRecentTransactions(madrasaId),
      this.repository.countActiveStudentsByGender(madrasaId),
      this.repository.findTodayStudentAttendanceCounts(madrasaId),
      this.repository.countPendingAdmissions(madrasaId),
      this.repository.findOverdueInvoices(madrasaId),
      this.repository.findUpcomingExams(madrasaId),
      this.repository.findActiveImportantLinks(),
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
      { male: 0, female: 0, unspecified: 0 }
    );

    const { PRESENT, ABSENT, LATE, LEAVE } = attendanceCounts;
    const attendanceTotal = PRESENT + ABSENT + LATE + LEAVE;
    const attendancePercentage =
      attendanceTotal > 0 ? Math.round(((PRESENT + LATE) / attendanceTotal) * 1000) / 10 : 0;

    const overdueTotalDue = overdueInvoices.reduce(
      (sum, invoice) => sum + (Number(invoice.amount) - Number(invoice.paidAmount)),
      0
    );

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
      overdueFees: {
        count: overdueInvoices.length,
        totalDue: overdueTotalDue,
        list: overdueInvoices.slice(0, DASHBOARD_OVERDUE_FEES_LIST_LIMIT).map((invoice) => ({
          id: invoice.id,
          title: invoice.title,
          studentName: invoice.student.nameBn,
          dueDate: invoice.dueDate,
          remaining: Number(invoice.amount) - Number(invoice.paidAmount),
        })),
      },
      upcomingExams,
      importantLinks: importantLinks.map((link) => ({
        id: link.id,
        label: link.label,
        subLabel: link.subLabel,
        url: link.url,
      })),
    };
  }

  async getTrends(madrasaId: number, groupBy: string): Promise<DashboardTrends> {
    const limit = DASHBOARD_TREND_ROW_LIMIT[groupBy] ?? DASHBOARD_TREND_DEFAULT_LIMIT;
    const accountsPeriodExpr = buildPeriodExpr(groupBy, ACCOUNTS_DATE_COLUMN);
    const attendancePeriodExpr = buildPeriodExpr(groupBy, ATTENDANCE_DATE_COLUMN);

    const [incomeExpenseRows, attendanceRows] = await Promise.all([
      this.repository.findIncomeExpenseTrend(madrasaId, accountsPeriodExpr, limit),
      this.repository.findAttendanceRateTrend(madrasaId, attendancePeriodExpr, limit),
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
