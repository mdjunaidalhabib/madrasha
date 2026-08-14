import { Prisma } from "@prisma/client";
import { NotFoundError } from "../../shared/errors";
import { logActivity } from "../../shared/utils/activity.util";
import { buildPeriodExpr } from "../../shared/utils/period-expr.util";
import { accountRepository, AccountRepository } from "./account.repository";
import {
  CreateExpenseRequestDto,
  CreateIncomeRequestDto,
  ListAccountsQueryDto,
  UpdateAccountRequestDto,
} from "./account.dto";
import { AccountOptions, ExpenseValidationError, IncomeValidationError, ReportRow } from "./account.types";
import {
  DEFAULT_INCOME_FUNDS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_MOSQUE_EXPENSES,
  DEFAULT_GRAVEYARD_EXPENSES,
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
} from "./account.constants";

const clean = (value: unknown): string | null =>
  value === undefined || value === null || value === "" ? null : String(value).trim();

const numberValue = (value: unknown): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

export class AccountService {
  constructor(private readonly repository: AccountRepository = accountRepository) {}

  getOptions(): AccountOptions {
    return {
      incomeFunds: DEFAULT_INCOME_FUNDS,
      expenseGroups: [
        { name: "সাধারণ ব্যয় বিভাগ", categories: DEFAULT_EXPENSE_CATEGORIES },
        { name: "মসজিদ ব্যয়", categories: DEFAULT_MOSQUE_EXPENSES },
        { name: "কবরস্থান ব্যয়", categories: DEFAULT_GRAVEYARD_EXPENSES },
      ],
      paymentMethods: PAYMENT_METHODS,
    };
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
      details: `Income added: ${amount}`,
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
      details: `Expense added: ${amount}`,
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
    if (query.fund) where.fund = clean(query.fund) || undefined;
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
    if (body.payment_method !== undefined) data.paymentMethod = clean(body.payment_method);
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
      details: `Entry updated`,
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
      details: `Entry deleted`,
    });

    return { message: ACCOUNT_DELETE_SUCCESS_MESSAGE };
  }
}

export const accountService = new AccountService();
