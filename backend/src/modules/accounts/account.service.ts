import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { logActivity } from "../../shared/utils/activity.util";
import { buildPeriodExpr } from "../../shared/utils/period-expr.util";
import { accountRepository, AccountRepository } from "./account.repository";
import {
  BulkDeleteAccountsRequestDto,
  CreateCategoryRequestDto,
  CreateExpenseRequestDto,
  CreateFundRequestDto,
  CreateIncomeRequestDto,
  ListAccountsQueryDto,
  UpdateAccountRequestDto,
  UpdateCategoryRequestDto,
  UpdateFundRequestDto,
} from "./account.dto";
import {
  AccountOptions,
  ExpenseValidationError,
  FundValidationError,
  IncomeValidationError,
  ReportRow,
} from "./account.types";
import {
  PAYMENT_METHODS,
  INCOME_SUCCESS_MESSAGE,
  EXPENSE_SUCCESS_MESSAGE,
  ACCOUNT_UPDATE_SUCCESS_MESSAGE,
  ACCOUNT_DELETE_SUCCESS_MESSAGE,
  ACCOUNT_NOT_FOUND_MESSAGE,
  ACCOUNT_ACTIVITY_ENTITY,
  ACCOUNT_LIST_ROW_LIMIT,
  RECEIPT_NO_PREFIX,
  VOUCHER_NO_PREFIX,
  FUND_NOT_FOUND_MESSAGE,
  CATEGORY_NOT_FOUND_MESSAGE,
  FUND_CREATE_SUCCESS_MESSAGE,
  FUND_UPDATE_SUCCESS_MESSAGE,
  FUND_DELETE_SUCCESS_MESSAGE,
  CATEGORY_CREATE_SUCCESS_MESSAGE,
  CATEGORY_UPDATE_SUCCESS_MESSAGE,
  CATEGORY_DELETE_SUCCESS_MESSAGE,
} from "./account.constants";

const clean = (value: unknown): string | null =>
  value === undefined || value === null || value === "" ? null : String(value).trim();

const numberValue = (value: unknown): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

export class AccountService {
  constructor(private readonly repository: AccountRepository = accountRepository) {}

  async getOptions(madrasaId: number): Promise<AccountOptions> {
    const fundCount = await this.repository.countFunds(madrasaId);
    if (fundCount === 0) {
      await this.repository.seedDefaultFunds(madrasaId);
    }

    const funds = await this.repository.findFunds(madrasaId);
    const toGroup = (fund: (typeof funds)[number]) => ({
      name: fund.name,
      categories: fund.categories.map((c) => c.name),
    });

    return {
      incomeFunds: funds.filter((f) => f.type === "income").map(toGroup),
      expenseGroups: funds.filter((f) => f.type === "expense").map(toGroup),
      paymentMethods: PAYMENT_METHODS,
    };
  }

  async listFunds(madrasaId: number, type?: "income" | "expense") {
    return this.repository.findFunds(madrasaId, type);
  }

  async createFund(madrasaId: number, body: CreateFundRequestDto) {
    const name = clean(body.name);
    if (!name || (body.type !== "income" && body.type !== "expense")) throw new FundValidationError();

    const fundCount = await this.repository.countFunds(madrasaId);
    const created = await this.repository.createFund({ madrasaId, type: body.type, name, sortOrder: fundCount });
    return { message: FUND_CREATE_SUCCESS_MESSAGE, id: created.id };
  }

  async updateFund(madrasaId: number, id: number, body: UpdateFundRequestDto) {
    const existing = await this.repository.findFundForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(FUND_NOT_FOUND_MESSAGE);

    const data: Prisma.AccountFundUpdateInput = {};
    if (body.name !== undefined) {
      const name = clean(body.name);
      if (!name) throw new FundValidationError();
      data.name = name;
    }
    if (body.sort_order !== undefined) data.sortOrder = Number(body.sort_order);
    if (body.is_active !== undefined) data.isActive = Boolean(body.is_active);

    const updated = await this.repository.updateFund(id, data);
    return { message: FUND_UPDATE_SUCCESS_MESSAGE, id: updated.id };
  }

  async deleteFund(madrasaId: number, id: number) {
    const existing = await this.repository.findFundForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(FUND_NOT_FOUND_MESSAGE);

    await this.repository.deleteFund(id);
    return { message: FUND_DELETE_SUCCESS_MESSAGE };
  }

  async createCategory(madrasaId: number, fundId: number, body: CreateCategoryRequestDto) {
    const fund = await this.repository.findFundForTenant(fundId, madrasaId);
    if (!fund) throw new NotFoundError(FUND_NOT_FOUND_MESSAGE);

    const name = clean(body.name);
    if (!name) throw new FundValidationError();

    const categoryCount = await this.repository.countCategories(fundId);
    const created = await this.repository.createCategory({
      fundId,
      name,
      sortOrder: categoryCount,
    });
    return { message: CATEGORY_CREATE_SUCCESS_MESSAGE, id: created.id };
  }

  async updateCategory(madrasaId: number, id: number, body: UpdateCategoryRequestDto) {
    const existing = await this.repository.findCategoryForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(CATEGORY_NOT_FOUND_MESSAGE);

    const data: Prisma.AccountCategoryUpdateInput = {};
    if (body.name !== undefined) {
      const name = clean(body.name);
      if (!name) throw new FundValidationError();
      data.name = name;
    }
    if (body.sort_order !== undefined) data.sortOrder = Number(body.sort_order);
    if (body.is_active !== undefined) data.isActive = Boolean(body.is_active);

    const updated = await this.repository.updateCategory(id, data);
    return { message: CATEGORY_UPDATE_SUCCESS_MESSAGE, id: updated.id };
  }

  async deleteCategory(madrasaId: number, id: number) {
    const existing = await this.repository.findCategoryForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(CATEGORY_NOT_FOUND_MESSAGE);

    await this.repository.deleteCategory(id);
    return { message: CATEGORY_DELETE_SUCCESS_MESSAGE };
  }

  async createIncome(madrasaId: number, userId: number, body: CreateIncomeRequestDto) {
    const amount = numberValue(body.amount);
    const receipt_no =
      clean(body.receipt_no) || (await this.nextSequenceNo("income", madrasaId, RECEIPT_NO_PREFIX));
    const fund = clean(body.fund);
    const category = clean(body.category);
    const donor_name = clean(body.donor_name);
    const address = clean(body.address);
    const mobile = clean(body.mobile);
    const payment_method = clean(body.payment_method);
    const note = clean(body.note);
    const entry_date = clean(body.entry_date) || new Date().toISOString().slice(0, 10);
    const entry_time = clean(body.entry_time) || new Date().toTimeString().slice(0, 8);

    if (!donor_name || !amount || !fund || !category || !payment_method) {
      throw new IncomeValidationError();
    }

    const created = await this.repository.create({
      madrasaId,
      type: "income",
      amount,
      category,
      description: donor_name,
      receiptNo: receipt_no,
      voucherNo: null,
      fund,
      donorName: donor_name,
      address,
      mobile,
      paymentMethod: payment_method,
      note,
      entryDate: new Date(entry_date),
      entryTime: new Date(`1970-01-01T${entry_time}`),
      createdBy: userId,
    });

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "CREATE",
      entity: ACCOUNT_ACTIVITY_ENTITY.INCOME,
      entity_id: created.id,
      details: `আয় যোগ করা হয়েছে: ${amount} টাকা`,
    });

    return { message: INCOME_SUCCESS_MESSAGE, id: created.id };
  }

  async createExpense(madrasaId: number, userId: number, body: CreateExpenseRequestDto) {
    const amount = numberValue(body.amount);
    const voucher_no =
      clean(body.voucher_no) || (await this.nextSequenceNo("expense", madrasaId, VOUCHER_NO_PREFIX));
    const fund = clean(body.fund);
    const category = clean(body.category);
    const receiver_name = clean(body.receiver_name);
    const mobile = clean(body.mobile);
    const payment_method = clean(body.payment_method);
    const note = clean(body.note);
    const entry_date = clean(body.entry_date) || new Date().toISOString().slice(0, 10);
    const entry_time = clean(body.entry_time) || new Date().toTimeString().slice(0, 8);

    if (!receiver_name || !amount || !fund || !category || !payment_method) {
      throw new ExpenseValidationError();
    }

    const created = await this.repository.create({
      madrasaId,
      type: "expense",
      amount,
      category,
      description: receiver_name,
      receiptNo: null,
      voucherNo: voucher_no,
      fund,
      receiverName: receiver_name,
      mobile,
      paymentMethod: payment_method,
      note,
      entryDate: new Date(entry_date),
      entryTime: new Date(`1970-01-01T${entry_time}`),
      createdBy: userId,
    });

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "CREATE",
      entity: ACCOUNT_ACTIVITY_ENTITY.EXPENSE,
      entity_id: created.id,
      details: `ব্যয় যোগ করা হয়েছে: ${amount} টাকা`,
    });

    return { message: EXPENSE_SUCCESS_MESSAGE, id: created.id };
  }

  async getReport(madrasaId: number, type: string, groupBy: string): Promise<ReportRow[]> {
    const dateColumn = "COALESCE(entry_date, CAST(created_at AS DATE))";

    if (groupBy === "fund") {
      return this.repository.findReportByFund(madrasaId);
    }

    if (groupBy === "category") {
      return this.repository.findReportByCategory(madrasaId);
    }

    if (groupBy === "fund_category") {
      return this.repository.findReportByFundCategory(madrasaId) as unknown as Promise<ReportRow[]>;
    }

    const periodExpr = buildPeriodExpr(type, dateColumn);

    return this.repository.findReportByPeriod(madrasaId, periodExpr);
  }

  /** Human-readable running number (e.g. RC-000123) shown on receipts/vouchers;
   * generated server-side since the entry form no longer collects it. */
  private async nextSequenceNo(type: "income" | "expense", madrasaId: number, prefix: string) {
    const count = await this.repository.countByType(madrasaId, type);
    return `${prefix}-${String(count + 1).padStart(6, "0")}`;
  }

  async list(madrasaId: number, query: ListAccountsQueryDto) {
    const where: Prisma.AccountWhereInput = {};
    if (query.type === "income" || query.type === "expense") where.type = query.type;
    // Free-text substring search (not an exact match, unlike category below)
    // - lets an admin find entries whose fund name doesn't match any current
    // ফান্ড ও খাত সেটিংস row (e.g. leftover from a past bug), for cleanup.
    const fundSearch = clean(query.fund);
    if (fundSearch) where.fund = { contains: fundSearch, mode: "insensitive" };
    if (query.category) where.category = clean(query.category) || undefined;
    if (query.from || query.to) {
      where.entryDate = {};
      if (query.from) where.entryDate.gte = new Date(query.from);
      if (query.to) where.entryDate.lte = new Date(query.to);
    }
    return this.repository.findMany(madrasaId, where, ACCOUNT_LIST_ROW_LIMIT);
  }

  async update(madrasaId: number, userId: number, id: number, body: UpdateAccountRequestDto) {
    const existing = await this.repository.findForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(ACCOUNT_NOT_FOUND_MESSAGE);

    const data: Prisma.AccountUpdateInput = {};
    if (body.amount !== undefined) {
      const amount = numberValue(body.amount);
      if (!amount) throw new (existing.type === "income" ? IncomeValidationError : ExpenseValidationError)();
      data.amount = amount;
    }
    if (body.fund !== undefined) data.fund = clean(body.fund);
    if (body.category !== undefined) data.category = clean(body.category);
    if (body.mobile !== undefined) data.mobile = clean(body.mobile);
    if (body.payment_method !== undefined) data.paymentMethod = clean(body.payment_method);
    if (body.note !== undefined) data.note = clean(body.note);
    if (body.entry_date !== undefined) {
      const entry_date = clean(body.entry_date);
      if (entry_date) data.entryDate = new Date(entry_date);
    }
    if (body.entry_time !== undefined) {
      const entry_time = clean(body.entry_time);
      if (entry_time) data.entryTime = new Date(`1970-01-01T${entry_time}`);
    }

    if (existing.type === "income") {
      if (body.receipt_no !== undefined) data.receiptNo = clean(body.receipt_no);
      if (body.address !== undefined) data.address = clean(body.address);
      if (body.donor_name !== undefined) {
        const donor_name = clean(body.donor_name);
        data.donorName = donor_name;
        data.description = donor_name;
      }
    } else {
      if (body.voucher_no !== undefined) data.voucherNo = clean(body.voucher_no);
      if (body.receiver_name !== undefined) {
        const receiver_name = clean(body.receiver_name);
        data.receiverName = receiver_name;
        data.description = receiver_name;
      }
    }

    const updated = await this.repository.update(id, data);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "UPDATE",
      entity:
        existing.type === "income" ? ACCOUNT_ACTIVITY_ENTITY.INCOME : ACCOUNT_ACTIVITY_ENTITY.EXPENSE,
      entity_id: updated.id,
      details: `${existing.type === "income" ? "আয়" : "ব্যয়"} হালনাগাদ করা হয়েছে: ${updated.amount} টাকা`,
    });

    return { message: ACCOUNT_UPDATE_SUCCESS_MESSAGE, id: updated.id };
  }

  async remove(madrasaId: number, userId: number, id: number) {
    const existing = await this.repository.findForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError(ACCOUNT_NOT_FOUND_MESSAGE);

    await this.repository.softDelete(id);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "DELETE",
      entity:
        existing.type === "income" ? ACCOUNT_ACTIVITY_ENTITY.INCOME : ACCOUNT_ACTIVITY_ENTITY.EXPENSE,
      entity_id: id,
      details: `${existing.type === "income" ? "আয়" : "ব্যয়"} মুছে ফেলা হয়েছে: ${existing.amount} টাকা`,
    });

    return { message: ACCOUNT_DELETE_SUCCESS_MESSAGE };
  }

  /** Deletes many entries at once (e.g. cleaning up a batch of stale/
   * misfiled entries) - scoped to `madrasaId` in a single query rather than
   * one findForTenant+softDelete per id, so a large selection stays fast. */
  async removeMany(madrasaId: number, userId: number, body: BulkDeleteAccountsRequestDto) {
    const numericIds = [...new Set((body.ids || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (numericIds.length === 0) throw new BadRequestError("মুছে ফেলার জন্য কোনো এন্ট্রি নির্বাচন করা হয়নি");

    const result = await this.repository.softDeleteMany(numericIds, madrasaId);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "DELETE",
      entity: "ACCOUNT",
      details: `${result.count} টি এন্ট্রি একসাথে মুছে ফেলা হয়েছে`,
    });

    return { message: `${result.count} টি এন্ট্রি মুছে ফেলা হয়েছে`, count: result.count };
  }
}

export const accountService = new AccountService();
