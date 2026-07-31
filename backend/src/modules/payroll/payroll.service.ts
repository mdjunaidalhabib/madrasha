import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { payrollRepository, PayrollRepository } from "./payroll.repository";
import {
  GeneratePayrollRequestDto,
  MarkPayrollPaidRequestDto,
  PayrollQueryDto,
} from "./payroll.dto";
import { MONTH_FORMAT_REGEX, PAYROLL_ACCOUNT_CATEGORY, PAYROLL_ACCOUNT_FUND } from "./payroll.constants";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const toNonNegative = (value: unknown, fallback = 0): number => {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) throw new BadRequestError("Amounts must be non-negative numbers");
  return num;
};

export class PayrollService {
  constructor(private readonly repository: PayrollRepository = payrollRepository) {}

  /**
   * Generates one PayrollRecord per active teacher for the given month.
   * Basic salary defaults to Teacher.salary; `overrides` lets the admin
   * adjust basic/allowances/deductions per teacher for this run only
   * (e.g. an advance deduction) without touching the teacher's base rate.
   * Safe to re-run: teachers already billed for the month are skipped.
   */
  async generate(madrasaId: number, dto: GeneratePayrollRequestDto) {
    if (!dto.month || !MONTH_FORMAT_REGEX.test(dto.month)) {
      throw new BadRequestError('month must be in "YYYY-MM" format');
    }

    const overrideMap = new Map(
      (dto.overrides || []).map((override) => [Number(override.teacher_id), override]),
    );

    try {
      const teachers = await this.repository.findActiveTeachers(madrasaId);
      if (teachers.length === 0) return { created: 0, skipped: 0, totalTeachers: 0 };

      const rows = teachers.map((teacher) => {
        const override = overrideMap.get(teacher.id);
        const basicSalary =
          override?.basic_salary !== undefined
            ? toNonNegative(override.basic_salary)
            : Number(teacher.salary || 0);
        const allowances = toNonNegative(override?.allowances, 0);
        const deductions = toNonNegative(override?.deductions, 0);
        const netAmount = basicSalary + allowances - deductions;

        return {
          madrasaId,
          teacherId: teacher.id,
          month: dto.month,
          basicSalary,
          allowances,
          deductions,
          netAmount,
        };
      });

      const created = await this.repository.runTransaction((tx) =>
        this.repository.generateOnTx(tx, rows),
      );

      return { created, skipped: teachers.length - created, totalTeachers: teachers.length };
    } catch (err) {
      return friendlyFailure("generatePayroll error:", err, "Failed to generate payroll");
    }
  }

  async list(madrasaId: number, query: PayrollQueryDto) {
    const where: Prisma.PayrollRecordWhereInput = {};
    if (query.month) where.month = query.month;
    if (query.teacher_id) where.teacherId = Number(query.teacher_id);
    if (query.status) where.status = query.status as any;

    try {
      return await this.repository.findMany(madrasaId, where);
    } catch (err) {
      return friendlyFailure("listPayroll error:", err, "Failed to load payroll records");
    }
  }

  /** Marks one payroll record as paid and mirrors it into the existing
   * accounts ledger as an expense, exactly like fee payments mirror into
   * income (see fee.service.ts recordPayment). */
  async markPaid(
    id: number,
    madrasaId: number,
    paidById: number | undefined,
    dto: MarkPayrollPaidRequestDto,
  ) {
    try {
      return await this.repository.runTransaction(async (tx) => {
        const record = await this.repository.findForTenantOnTx(tx, id, madrasaId);
        if (!record) throw new NotFoundError("Payroll record not found");
        if (record.status === "PAID") throw new BadRequestError("This payroll is already paid");

        const ledgerEntry = await tx.account.create({
          data: {
            madrasaId,
            type: "expense",
            amount: record.netAmount,
            category: PAYROLL_ACCOUNT_CATEGORY,
            fund: PAYROLL_ACCOUNT_FUND,
            description: `Salary for ${record.month} (Teacher #${record.teacherId})`,
            paymentMethod: "CASH",
            entryDate: new Date(),
            createdBy: paidById ?? null,
            voucherNo: dto.transaction_ref?.trim() || null,
          },
        });

        await this.repository.markPaidOnTx(tx, id, {
          paidAt: new Date(),
          paidById: paidById ?? null,
          accountEntryId: ledgerEntry.id,
        });

        return { payrollId: id, netAmount: Number(record.netAmount) };
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("markPayrollPaid error:", err, "Failed to mark payroll as paid");
    }
  }
}

export const payrollService = new PayrollService();
