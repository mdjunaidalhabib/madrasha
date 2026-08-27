import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { notificationService } from "../notifications/notification.service";
import { payrollRepository, PayrollRepository } from "./payroll.repository";
import { GeneratePayrollRequestDto, MarkPayrollPaidRequestDto, PayrollQueryDto } from "./payroll.dto";
import { MONTH_FORMAT_REGEX, YEAR_FORMAT_REGEX } from "./payroll.constants";

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

  /** `year` powers the শিক্ষক বেতন রেজিস্টার (salary register) report - every
   * record for that year across all teachers/months in one call, so the
   * frontend can build a teacher × month due/paid matrix without hammering
   * the API per month. */
  async list(madrasaId: number, query: PayrollQueryDto) {
    if (query.year && !YEAR_FORMAT_REGEX.test(query.year)) {
      throw new BadRequestError('year must be in "YYYY" format');
    }

    const where: Prisma.PayrollRecordWhereInput = {};
    if (query.month) where.month = query.month;
    else if (query.year) where.month = { startsWith: query.year };
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
   * income (see fee.service.ts recordPayment). `dto.fund`/`dto.category`
   * come from the caller's live ফান্ড ও খাত সেটিংস selection (see
   * useAccountOptions on the frontend) - never hardcoded here, so a renamed
   * or reconfigured fund/category is always reflected correctly. */
  async markPaid(
    id: number,
    madrasaId: number,
    paidById: number | undefined,
    dto: MarkPayrollPaidRequestDto,
  ) {
    const fund = dto.fund?.trim();
    const category = dto.category?.trim();
    if (!fund || !category) {
      throw new BadRequestError("ফান্ড ও খাত নির্বাচন করা আবশ্যক");
    }

    let result: { payrollId: number; netAmount: number; teacherName: string; teacherPhone: string | null; month: string };
    try {
      result = await this.repository.runTransaction(async (tx) => {
        const record = await this.repository.findForTenantOnTx(tx, id, madrasaId);
        if (!record) throw new NotFoundError("Payroll record not found");
        if (record.status === "PAID") throw new BadRequestError("This payroll is already paid");

        const ledgerEntry = await tx.account.create({
          data: {
            madrasaId,
            type: "expense",
            amount: record.netAmount,
            category,
            fund,
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

        return {
          payrollId: id,
          netAmount: Number(record.netAmount),
          teacherName: record.teacher.nameBn,
          teacherPhone: record.teacher.phone,
          month: record.month,
        };
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("markPayrollPaid error:", err, "Failed to mark payroll as paid");
    }

    await notificationService.triggerEvent(madrasaId, "SALARY_PAYMENT", result.teacherPhone, {
      name: result.teacherName,
      amount: result.netAmount,
      month: result.month,
    });

    return { payrollId: result.payrollId, netAmount: result.netAmount };
  }
}

export const payrollService = new PayrollService();
