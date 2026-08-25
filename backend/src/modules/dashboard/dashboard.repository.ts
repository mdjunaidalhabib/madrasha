import { prisma } from "../../shared/database/prisma";
import { DASHBOARD_RECENT_TRANSACTIONS_LIMIT, DASHBOARD_UPCOMING_EXAMS_LIMIT } from "./dashboard.constants";
import {
  AttendanceTrendRow,
  FundBalanceRow,
  IncomeExpenseTrendRow,
  ImportantLinkRow,
  PaymentMethodTotalRow,
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

  countActiveStudentsByGender(madrasaId: number) {
    return prisma.student.groupBy({
      by: ["gender"],
      where: { madrasaId, isActive: 1, deletedAt: null },
      _count: { _all: true },
    });
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

  // Tenants have accumulated free-text payment_method values over time
  // ("CASH", "নগদ টাকা", "Bkash", "ব্যাংক / মোবাইল ব্যাংকিং", NULL on old
  // rows, ...) - grouping by the raw column would silently drop anything
  // that doesn't exactly match today's picklist out of both buckets, making
  // online+offline undercount the real total. Classify by keyword instead:
  // anything mentioning bank/mobile (in English or Bangla) is "online",
  // everything else (cash and unrecognized/NULL values) is "offline" - so
  // the two buckets always sum to the tenant's true total.
  findPaymentMethodTotals(madrasaId: number) {
    return prisma.$queryRaw<PaymentMethodTotalRow[]>`
      SELECT
        CASE
          WHEN payment_method ~* 'bank|mobile|bkash|nagad|rocket|upay|ব্যাংক|মোবাইল'
            THEN 'online'
          ELSE 'offline'
        END AS payment_method,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
      FROM accounts
      WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL
      GROUP BY 1
    `;
  }

  findRecentTransactions(madrasaId: number) {
    return prisma.$queryRaw<RecentTransactionRow[]>`
      SELECT id, type, amount, fund, category,
        payment_method AS "paymentMethod",
        receipt_no AS "receiptNo",
        voucher_no AS "voucherNo",
        donor_name AS "donorName",
        receiver_name AS "receiverName",
        address, mobile, note,
        COALESCE(entry_date, CAST(created_at AS DATE)) AS "entryDate",
        entry_time AS "entryTime"
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
      select: {
        id: true,
        title: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        student: { select: { nameBn: true } },
      },
      orderBy: { dueDate: "asc" },
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

  /** Global (not tenant-scoped) "গুরুত্বপূর্ণ লিংক" list managed by Super
   * Admin - same list shown on every madrasa's Dashboard. */
  findActiveImportantLinks(): Promise<ImportantLinkRow[]> {
    return prisma.importantLink.findMany({
      where: { isActive: true },
      select: { id: true, label: true, subLabel: true, url: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
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
