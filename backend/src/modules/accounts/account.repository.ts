import { Prisma, AccountType } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { REPORT_ROW_LIMIT, DEFAULT_INCOME_FUNDS, DEFAULT_EXPENSE_GROUPS } from "./account.constants";
import { ReportRow } from "./account.types";

// NOTE: the old `ensureAccountSchema()` ran ALTER TABLE at request-time to
// patch missing `accounts` columns on the fly. With Prisma, schema.prisma
// is the single source of truth and `npx prisma migrate dev` handles this
// once - no runtime DDL needed anymore, so that function was removed.
export class AccountRepository {
  create(data: Prisma.AccountUncheckedCreateInput) {
    return prisma.account.create({ data });
  }

  countByType(madrasaId: number, type: "income" | "expense") {
    return prisma.account.count({ where: { madrasaId, type } });
  }

  findMany(madrasaId: number, where: Prisma.AccountWhereInput, take: number) {
    return prisma.account.findMany({
      where: { madrasaId, deletedAt: null, ...where },
      orderBy: [{ entryDate: "desc" }, { entryTime: "desc" }, { id: "desc" }],
      take,
    });
  }

  findForTenant(id: number, madrasaId: number) {
    return prisma.account.findFirst({ where: { id, madrasaId, deletedAt: null } });
  }

  update(id: number, data: Prisma.AccountUpdateInput) {
    return prisma.account.update({ where: { id }, data });
  }

  softDelete(id: number) {
    return prisma.account.update({ where: { id }, data: { deletedAt: new Date() } });
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
       FROM accounts WHERE madrasa_id = $1 AND deleted_at IS NULL
       GROUP BY ${periodExpr} ORDER BY period DESC LIMIT ${REPORT_ROW_LIMIT}`,
      madrasaId,
    );
  }

  countFunds(madrasaId: number) {
    return prisma.accountFund.count({ where: { madrasaId } });
  }

  findFunds(madrasaId: number, type?: AccountType) {
    return prisma.accountFund.findMany({
      where: { madrasaId, isActive: true, ...(type ? { type } : {}) },
      orderBy: { sortOrder: "asc" },
      include: { categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    });
  }

  findFundForTenant(id: number, madrasaId: number) {
    return prisma.accountFund.findFirst({ where: { id, madrasaId } });
  }

  createFund(data: Prisma.AccountFundUncheckedCreateInput) {
    return prisma.accountFund.create({ data });
  }

  updateFund(id: number, data: Prisma.AccountFundUpdateInput) {
    return prisma.accountFund.update({ where: { id }, data });
  }

  deleteFund(id: number) {
    return prisma.accountFund.delete({ where: { id } });
  }

  countCategories(fundId: number) {
    return prisma.accountCategory.count({ where: { fundId } });
  }

  findCategoryForTenant(id: number, madrasaId: number) {
    return prisma.accountCategory.findFirst({ where: { id, fund: { madrasaId } }, include: { fund: true } });
  }

  createCategory(data: Prisma.AccountCategoryUncheckedCreateInput) {
    return prisma.accountCategory.create({ data });
  }

  updateCategory(id: number, data: Prisma.AccountCategoryUpdateInput) {
    return prisma.accountCategory.update({ where: { id }, data });
  }

  deleteCategory(id: number) {
    return prisma.accountCategory.delete({ where: { id } });
  }

  /** Lazily backfills the starter ফান্ড/খাত picklist for a tenant that has
   * none yet (existing installs from before this feature, and brand-new
   * madrasas alike) - called once from AccountService.getOptions(). */
  seedDefaultFunds(madrasaId: number) {
    return prisma.$transaction([
      ...DEFAULT_INCOME_FUNDS.map((fund, i) =>
        prisma.accountFund.create({
          data: {
            madrasaId,
            type: "income",
            name: fund.name,
            sortOrder: i,
            categories: { create: fund.categories.map((name, j) => ({ name, sortOrder: j })) },
          },
        }),
      ),
      ...DEFAULT_EXPENSE_GROUPS.map((group, i) =>
        prisma.accountFund.create({
          data: {
            madrasaId,
            type: "expense",
            name: group.name,
            sortOrder: i,
            categories: { create: group.categories.map((name, j) => ({ name, sortOrder: j })) },
          },
        }),
      ),
    ]);
  }
}

export const accountRepository = new AccountRepository();
