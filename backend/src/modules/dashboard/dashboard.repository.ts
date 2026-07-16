import { prisma } from "../../shared/database/prisma";
import { DASHBOARD_RECENT_TRANSACTIONS_LIMIT } from "./dashboard.constants";
import { FundBalanceRow, RecentTransactionRow, TodayTotalsRow } from "./dashboard.types";

export class DashboardRepository {
  countActiveStudents(madrasaId: number) {
    return prisma.student.count({ where: { madrasaId, isActive: 1 } });
  }

  countActiveTeachers(madrasaId: number) {
    return prisma.teacher.count({ where: { madrasaId, isActive: 1 } });
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
}

export const dashboardRepository = new DashboardRepository();
