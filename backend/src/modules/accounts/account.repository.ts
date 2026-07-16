import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { REPORT_ROW_LIMIT } from "./account.constants";
import { ReportRow } from "./account.types";

// NOTE: the old `ensureAccountSchema()` ran ALTER TABLE at request-time to
// patch missing `accounts` columns on the fly. With Prisma, schema.prisma
// is the single source of truth and `npx prisma migrate dev` handles this
// once - no runtime DDL needed anymore, so that function was removed.
export class AccountRepository {
  create(data: Prisma.AccountUncheckedCreateInput) {
    return prisma.account.create({ data });
  }

  findReportByFund(madrasaId: number) {
    return prisma.$queryRaw<ReportRow[]>`
      SELECT fund AS period,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense
      FROM accounts WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL
      GROUP BY fund ORDER BY fund
    `;
  }

  findReportByCategory(madrasaId: number) {
    return prisma.$queryRaw<ReportRow[]>`
      SELECT category AS period,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense
      FROM accounts WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL
      GROUP BY category ORDER BY category
    `;
  }

  // `type` only ever takes one of three literal values (validated by the
  // caller's ternary, not user-supplied SQL), so building this fragment is
  // safe to interpolate - $queryRawUnsafe is used only for the fragment,
  // the actual madrasa_id value stays parameterized.
  findReportByPeriod(madrasaId: number, periodExpr: string) {
    return prisma.$queryRawUnsafe<ReportRow[]>(
      `SELECT ${periodExpr} AS period,
        SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense
       FROM accounts WHERE madrasa_id = ? AND deleted_at IS NULL
       GROUP BY ${periodExpr} ORDER BY period DESC LIMIT ${REPORT_ROW_LIMIT}`,
      madrasaId,
    );
  }
}

export const accountRepository = new AccountRepository();
