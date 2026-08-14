import { prisma } from "../../shared/database/prisma";
import { DASHBOARD_RECENT_TRANSACTIONS_LIMIT, DASHBOARD_UPCOMING_EXAMS_LIMIT } from "./dashboard.constants";
import {
  AttendanceTrendRow,
  FundBalanceRow,
  IncomeExpenseTrendRow,
  RecentTransactionRow,
  TodayTotalsRow,
  UpcomingExamRow,
} from "./dashboard.types";

const startOfTodayUTC = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export class DashboardRepository {
  countActiveStudents(madrasaId: number) {
    return prisma.student.count({ where: { madrasaId, isActive: 1, deletedAt: null } });
  }

  countActiveTeachers(madrasaId: number) {
    return prisma.teacher.count({ where: { madrasaId, isActive: 1, deletedAt: null } });
  }

  countUsers(madrasaId: number) {
    return prisma.user.count({ where: { madrasaId } });
  }

  sumAccountsByType(madrasaId: number, type: "income" | "expense") {
    return prisma.account.aggregate({
      where: { madrasaId, type, deletedAt: null },
      _sum: { amount: true },
    });
  }

  // CURRENT_DATE/GROUP BY combos are cleaner left as raw SQL than emulated in JS.
  findTodayTotals(madrasaId: number) {
    return prisma.$queryRaw<TodayTotalsRow[]>`
      SELECT
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
      FROM accounts
      WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL
        AND COALESCE(entry_date, CAST(created_at AS DATE)) = CURRENT_DATE
    `;
  }

  findFundBalances(madrasaId: number) {
    return prisma.$queryRaw<FundBalanceRow[]>`
      SELECT fund, SUM(CASE WHEN type='income' THEN amount ELSE -amount END) AS balance
      FROM accounts
      WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL
      GROUP BY fund ORDER BY fund
    `;
  }

  findRecentTransactions(madrasaId: number) {
    return prisma.$queryRaw<RecentTransactionRow[]>`
      SELECT id, type, amount, fund, category, payment_method,
        COALESCE(entry_date, CAST(created_at AS DATE)) as entry_date
      FROM accounts
      WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL
      ORDER BY COALESCE(entry_date, CAST(created_at AS DATE)) DESC, id DESC
      LIMIT ${DASHBOARD_RECENT_TRANSACTIONS_LIMIT}
    `;
  }

  async findTodayStudentAttendanceCounts(madrasaId: number) {
    const groups = await prisma.attendance.groupBy({
      by: ["status"],
      where: { madrasaId, attendeeType: "STUDENT", date: startOfTodayUTC() },
      _count: { _all: true },
    });
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    for (const group of groups) {
      counts[group.status] = group._count._all;
    }
    return counts;
  }

  countPendingAdmissions(madrasaId: number) {
    return prisma.student.count({
      where: { madrasaId, admissionStatus: "PENDING", deletedAt: null },
    });
  }

  async findOverdueInvoices(madrasaId: number) {
    return prisma.invoice.findMany({
      where: {
        madrasaId,
        dueDate: { lt: startOfTodayUTC() },
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      select: { amount: true, paidAmount: true },
    });
  }

  // `periodExpr` is server-built (buildPeriodExpr, a fixed 3-branch
  // ternary), never user input, so it is safe to interpolate directly —
  // madrasaId stays parameterized. Same discipline as account.repository.ts.
  findIncomeExpenseTrend(madrasaId: number, periodExpr: string, limit: number) {
    return prisma.$queryRawUnsafe<IncomeExpenseTrendRow[]>(
      `SELECT ${periodExpr} AS period,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense
       FROM accounts WHERE madrasa_id = $1 AND deleted_at IS NULL
       GROUP BY ${periodExpr} ORDER BY period DESC LIMIT ${limit}`,
      madrasaId,
    );
  }

  findAttendanceRateTrend(madrasaId: number, periodExpr: string, limit: number) {
    return prisma.$queryRawUnsafe<AttendanceTrendRow[]>(
      `SELECT ${periodExpr} AS period,
        COUNT(*) FILTER (WHERE status IN ('PRESENT','LATE')) AS present,
        COUNT(*) AS total
       FROM attendances WHERE madrasa_id = $1 AND attendee_type = 'STUDENT'
       GROUP BY ${periodExpr} ORDER BY period DESC LIMIT ${limit}`,
      madrasaId,
    );
  }

  async findUpcomingExams(madrasaId: number): Promise<UpcomingExamRow[]> {
    const rows = await prisma.examRoutine.findMany({
      where: { madrasaId, examDate: { gte: startOfTodayUTC() }, exam: { deletedAt: null } },
      orderBy: { examDate: "asc" },
      take: DASHBOARD_UPCOMING_EXAMS_LIMIT,
      include: {
        exam: { select: { name: true } },
        class: { select: { nameBn: true, name: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      examName: row.exam.name,
      className: row.class.nameBn || row.class.name || "",
      subject: row.subject,
      examDate: row.examDate,
      startTime: row.startTime,
      endTime: row.endTime,
    }));
  }
}

export const dashboardRepository = new DashboardRepository();
