import { logActivity } from "../../shared/utils/activity.util";
import { accountRepository, AccountRepository } from "./account.repository";
import { CreateExpenseRequestDto, CreateIncomeRequestDto } from "./account.dto";
import { AccountOptions, ExpenseValidationError, IncomeValidationError, ReportRow } from "./account.types";
import {
  DEFAULT_INCOME_FUNDS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_MOSQUE_EXPENSES,
  DEFAULT_GRAVEYARD_EXPENSES,
  PAYMENT_METHODS,
  INCOME_SUCCESS_MESSAGE,
  EXPENSE_SUCCESS_MESSAGE,
  ACCOUNT_ACTIVITY_ENTITY,
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
    const receipt_no = clean(body.receipt_no);
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
    const voucher_no = clean(body.voucher_no);
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

    const periodExpr =
      type === "daily"
        ? `CAST(${dateColumn} AS DATE)`
        : type === "yearly"
          ? `EXTRACT(YEAR FROM ${dateColumn})`
          : `TO_CHAR(${dateColumn}, 'YYYY-MM')`;

    return this.repository.findReportByPeriod(madrasaId, periodExpr);
  }
}

export const accountService = new AccountService();
