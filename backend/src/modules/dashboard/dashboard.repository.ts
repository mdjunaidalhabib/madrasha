import { prisma } from "../../shared/database/prisma";
import { Prisma } from "@prisma/client";
import {
  DashboardScope,
  sessionDateSql,
  sessionDateWhere,
  studentSessionWhere,
} from "./dashboard.scope";
import {
  DASHBOARD_RECENT_TRANSACTIONS_LIMIT,
  DASHBOARD_OVERDUE_FEES_LIST_LIMIT,
  DASHBOARD_UPCOMING_EXAMS_LIMIT,
} from "./dashboard.constants";
import {
  AttendanceTrendRow,
  OverdueFeesSummary,
  FundBalanceRow,
  IncomeExpenseTrendRow,
  ImportantLinkRow,
  PaymentMethodTotalRow,
  RecentTransactionRow,
  TodayTotalsRow,
  UpcomingExamRow,
} from "./dashboard.types";
import { startOfTodayUTC, endOfTodayUTC } from "../../shared/utils/date.util";
import {
  tenantClassNameSelect,
  tenantClassName,
  tenantDivisionNameSelect,
  withTenantDivisionName,
} from "../../shared/utils/tenant-name.util";

export class DashboardRepository {
  async findDashboardSessions(madrasaId: number) {
    const rows = await prisma.session.findMany({
      where: { madrasaId },
      select: {
        id: true,
        name: true,
        divisionId: true,
        startDate: true,
        endDate: true,
        isActive: true,
        division: { select: { id: true, ...tenantDivisionNameSelect(madrasaId) } },
      },
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
    });
    return rows.map((row) => ({ ...row, division: withTenantDivisionName(row.division) }));
  }
  // A PENDING admission isn't a real enrolled student yet (see
  // student.service.ts:admitStudent), and a REJECTED one never became one -
  // only APPROVED admissions should count as "students" on the dashboard.
  // isActive alone isn't enough to exclude these, since it defaults to 1
  // regardless of admissionStatus at creation time.
  countActiveStudents(madrasaId: number, scope: DashboardScope) {
    return prisma.student.count({
      where: {
        madrasaId,
        isActive: 1,
        deletedAt: null,
        admissionStatus: "APPROVED",
        ...studentSessionWhere(scope),
      },
    });
  }

  countActiveTeachers(madrasaId: number) {
    return prisma.teacher.count({ where: { madrasaId, isActive: 1, deletedAt: null } });
  }

  countActiveStudentsByGender(madrasaId: number, scope: DashboardScope) {
    return prisma.student.groupBy({
      by: ["gender"],
      where: {
        madrasaId,
        isActive: 1,
        deletedAt: null,
        admissionStatus: "APPROVED",
        ...studentSessionWhere(scope),
      },
      _count: { _all: true },
    });
  }

  countUsers(madrasaId: number) {
    return prisma.user.count({ where: { madrasaId } });
  }

  sumAccountsByType(madrasaId: number, type: "income" | "expense", scope?: DashboardScope) {
    return prisma.account.aggregate({
      where: {
        madrasaId,
        type,
        deletedAt: null,
        ...(scope && scope.mode !== "all"
          ? {
              OR: sessionDateWhere(scope)!.flatMap((range) => [
                { entryDate: range },
                { entryDate: null, createdAt: range },
              ]),
            }
          : {}),
      },
      _sum: { amount: true },
    });
  }

  // CURRENT_DATE/GROUP BY combos are cleaner left as raw SQL than emulated in JS.
  findTodayTotals(madrasaId: number, scope: DashboardScope) {
    return prisma.$queryRaw<TodayTotalsRow[]>`
      SELECT
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
      FROM accounts
      WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL
        AND COALESCE(entry_date, CAST(created_at AS DATE)) = CURRENT_DATE
        AND ${sessionDateSql(scope, Prisma.sql`COALESCE(entry_date, CAST(created_at AS DATE))`)}
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
  findPaymentMethodTotals(madrasaId: number, scope: DashboardScope) {
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
        AND ${sessionDateSql(scope, Prisma.sql`COALESCE(entry_date, CAST(created_at AS DATE))`)}
      GROUP BY 1
    `;
  }

  findRecentTransactions(madrasaId: number, scope: DashboardScope) {
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
        AND ${sessionDateSql(scope, Prisma.sql`COALESCE(entry_date, CAST(created_at AS DATE))`)}
      ORDER BY COALESCE(entry_date, CAST(created_at AS DATE)) DESC, id DESC
      LIMIT ${DASHBOARD_RECENT_TRANSACTIONS_LIMIT}
    `;
  }

  async findTodayStudentAttendanceCounts(madrasaId: number, scope: DashboardScope) {
    const groups = await prisma.$queryRaw<
      { status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE"; count: bigint }[]
    >`
      SELECT status, COUNT(*) AS count FROM attendances
      WHERE madrasa_id = ${madrasaId} AND attendee_type = 'STUDENT' AND date = ${startOfTodayUTC()}
        AND ${sessionDateSql(scope, Prisma.sql`date`)}
        AND ${
          scope.mode === "all"
            ? Prisma.sql`TRUE`
            : Prisma.sql`attendee_id IN (
          SELECT id FROM students WHERE madrasa_id = ${madrasaId}
            AND session_id = ANY(${scope.selected.map((s) => s.id)}::int[])
        )`
        }
      GROUP BY status
    `;
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    for (const group of groups) {
      counts[group.status] = Number(group.count);
    }
    return counts;
  }

  countPendingAdmissions(madrasaId: number, scope: DashboardScope) {
    return prisma.student.count({
      where: {
        madrasaId,
        admissionStatus: "PENDING",
        deletedAt: null,
        ...studentSessionWhere(scope),
      },
    });
  }

  /** Backs the dashboard's "বকেয়া ফি" widget - every unpaid/partially-paid
   * invoice due today or earlier (see endOfTodayUTC doc-comment above for
   * why "today" is included, not just strictly-past due dates).
   *
   * Excludes invoices belonging to REJECTED admissions: the admission-fee
   * invoice is billed at submission time while the admission still sits
   * PENDING (see student.service.ts:admitStudent), so it's meant to keep
   * showing here until reviewed - but once a Muhtamim rejects it, the
   * admission is cancelled and that fee is no longer collectible, so it
   * must stop showing as outstanding. */
  async findOverdueSummary(madrasaId: number, scope: DashboardScope): Promise<OverdueFeesSummary> {
    // Aggregate every qualifying invoice in PostgreSQL, returning only the
    // largest student balances. Totals are calculated BEFORE limiting the list.
    const [row] = await prisma.$queryRaw<
      {
        count: bigint;
        studentCount: bigint;
        totalDue: number;
        list: (Omit<OverdueFeesSummary["list"][number], "oldestDueDate"> & {
          oldestDueDate: string;
        })[];
      }[]
    >`
      WITH overdue AS (
        SELECT i.student_id, s.name_bn,
          COUNT(*) AS invoice_count, MIN(i.due_date) AS oldest_due_date,
          SUM(i.amount - i.paid_amount - COALESCE(i.waived_amount, 0)) AS remaining
        FROM invoices i JOIN students s ON s.id = i.student_id
        WHERE i.madrasa_id = ${madrasaId}
          AND i.due_date <= ${endOfTodayUTC()}
          AND i.status IN ('UNPAID', 'PARTIALLY_PAID')
          AND s.admission_status <> 'REJECTED'
          AND ${
            scope.mode === "all"
              ? Prisma.sql`TRUE`
              : Prisma.sql`COALESCE(
            (SELECT fs.session_id FROM fee_structures fs WHERE fs.id = i.fee_structure_id AND fs.madrasa_id = ${madrasaId}),
            s.session_id
          ) = ANY(${scope.selected.map((s) => s.id)}::int[])`
          }
        GROUP BY i.student_id, s.name_bn
      )
      SELECT COALESCE(SUM(invoice_count), 0)::bigint AS count,
        COUNT(*) AS "studentCount", COALESCE(SUM(remaining), 0) AS "totalDue",
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'studentId', student_id, 'studentName', name_bn,
            'invoiceCount', invoice_count, 'oldestDueDate', oldest_due_date,
            'remaining', remaining
          ) ORDER BY remaining DESC, oldest_due_date, student_id)
          FROM (SELECT * FROM overdue ORDER BY remaining DESC, oldest_due_date, student_id
            LIMIT ${DASHBOARD_OVERDUE_FEES_LIST_LIMIT}) top_due
        ), '[]'::jsonb) AS list
      FROM overdue
    `;
    return {
      count: Number(row?.count || 0),
      studentCount: Number(row?.studentCount || 0),
      totalDue: Number(row?.totalDue || 0),
      list: (row?.list || []).map((item) => ({
        ...item,
        oldestDueDate: new Date(item.oldestDueDate),
      })),
    };
  }

  // `periodExpr` is server-built (buildPeriodExpr, a fixed 3-branch
  // ternary), never user input, so it is safe to interpolate directly —
  // madrasaId stays parameterized. Same discipline as account.repository.ts.
  findIncomeExpenseTrend(
    madrasaId: number,
    periodExpr: string,
    limit: number,
    scope: DashboardScope,
  ) {
    const period = Prisma.raw(periodExpr);
    return prisma.$queryRaw<IncomeExpenseTrendRow[]>`
      SELECT ${period} AS period,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense
       FROM accounts WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL
         AND ${sessionDateSql(scope, Prisma.sql`COALESCE(entry_date, CAST(created_at AS DATE))`)}
       GROUP BY ${period} ORDER BY period DESC LIMIT ${limit}
    `;
  }

  findAttendanceRateTrend(
    madrasaId: number,
    periodExpr: string,
    limit: number,
    scope: DashboardScope,
  ) {
    const period = Prisma.raw(periodExpr);
    return prisma.$queryRaw<AttendanceTrendRow[]>`
      SELECT ${period} AS period,
        COUNT(*) FILTER (WHERE status IN ('PRESENT','LATE')) AS present,
        COUNT(*) AS total
       FROM attendances WHERE madrasa_id = ${madrasaId} AND attendee_type = 'STUDENT'
         AND ${sessionDateSql(scope, Prisma.sql`date`)}
         AND ${
           scope.mode === "all"
             ? Prisma.sql`TRUE`
             : Prisma.sql`attendee_id IN (
           SELECT id FROM students WHERE madrasa_id = ${madrasaId}
             AND session_id = ANY(${scope.selected.map((s) => s.id)}::int[])
         )`
         }
       GROUP BY ${period} ORDER BY period DESC LIMIT ${limit}
    `;
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

  async findUpcomingExams(madrasaId: number, scope: DashboardScope): Promise<UpcomingExamRow[]> {
    const rows = await prisma.examRoutine.findMany({
      // Active exams only - dormant (demo / not yet started) exams keep
      // their routines but aren't really "upcoming". Same-day slots follow
      // start time, then শ্রেণি order, so the list reads like the routine.
      where: {
        madrasaId,
        examDate: { gte: startOfTodayUTC() },
        exam: { deletedAt: null, isActive: true },
        ...(scope.mode !== "all"
          ? {
              OR: scope.selected.map((session) => ({
                examDate: { gte: session.startDate, lte: session.endDate },
                ...(session.divisionId != null
                  ? { class: { divisionId: session.divisionId } }
                  : {}),
              })),
            }
          : {}),
      },
      orderBy: [
        { examDate: "asc" },
        { startTime: "asc" },
        { class: { sortOrder: "asc" } },
        { id: "asc" },
      ],
      take: DASHBOARD_UPCOMING_EXAMS_LIMIT,
      include: {
        exam: { select: { name: true } },
        class: { select: tenantClassNameSelect(madrasaId) },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      examName: row.exam.name,
      className: tenantClassName(row.class) || "",
      subject: row.subject,
      examDate: row.examDate,
      startTime: row.startTime,
      endTime: row.endTime,
    }));
  }
}

export const dashboardRepository = new DashboardRepository();
