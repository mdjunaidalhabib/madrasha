import { BadRequestError } from "../../shared/errors";
import { INCOME_VALIDATION_MESSAGE, EXPENSE_VALIDATION_MESSAGE } from "./account.constants";

export class IncomeValidationError extends BadRequestError {
  constructor() {
    super(INCOME_VALIDATION_MESSAGE);
  }
}

export class ExpenseValidationError extends BadRequestError {
  constructor() {
    super(EXPENSE_VALIDATION_MESSAGE);
  }
}

export interface AccountOptions {
  incomeFunds: typeof import("./account.constants").DEFAULT_INCOME_FUNDS;
  expenseGroups: Array<{ name: string; categories: string[] }>;
  paymentMethods: string[];
}

export type ReportGroupBy = "period" | "fund" | "category";
export type ReportType = "daily" | "monthly" | "yearly";

export interface ReportRow {
  period: string;
  total_income: number;
  total_expense: number;
}
