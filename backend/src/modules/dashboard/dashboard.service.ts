import { dashboardRepository, DashboardRepository } from "./dashboard.repository";
import { DashboardSummary } from "./dashboard.types";

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
      recent,
      attendanceCounts,
      pendingAdmissionsCount,
      overdueInvoices,
      upcomingExams,
    ] = await Promise.all([
      this.repository.countActiveStudents(madrasaId),
      this.repository.countActiveTeachers(madrasaId),
      this.repository.countUsers(madrasaId),
      this.repository.sumAccountsByType(madrasaId, "income"),
      this.repository.sumAccountsByType(madrasaId, "expense"),
      this.repository.findTodayTotals(madrasaId),
      this.repository.findFundBalances(madrasaId),
      this.repository.findRecentTransactions(madrasaId),
      this.repository.findTodayStudentAttendanceCounts(madrasaId),
      this.repository.countPendingAdmissions(madrasaId),
      this.repository.findOverdueInvoices(madrasaId),
      this.repository.findUpcomingExams(madrasaId),
    ]);

    const income = Number(incomeAgg._sum.amount || 0);
    const expense = Number(expenseAgg._sum.amount || 0);

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
      recentTransactions: recent,
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
      },
      upcomingExams,
    };
  }
}

export const dashboardService = new DashboardService();
