import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { feeRepository, FeeRepository } from "./fee.repository";
import { studentRepository } from "../students/student.repository";
import { notificationService } from "../notifications/notification.service";
import {
  CreateFeeStructureRequestDto,
  CreatePaymentMethodSettingRequestDto,
  GenerateInvoicesRequestDto,
  InvoiceQueryDto,
  PendingInvoicesQueryDto,
  RecordPaymentRequestDto,
  UpdateFeeStructureRequestDto,
  UpdatePaymentMethodSettingRequestDto,
  WaiveInvoiceRequestDto,
} from "./fee.dto";
import {
  FEE_FREQUENCIES,
  FEE_TYPES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_TYPES,
  FEE_ACCOUNT_CATEGORY,
  FEE_ACCOUNT_FUND,
} from "./fee.constants";

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const toAmount = (value: unknown, label: string): number => {
  const amount = Number(value);
  if (Number.isNaN(amount) || amount <= 0) throw new BadRequestError(`${label} must be a positive number`);
  return amount;
};

const deriveStatus = (
  amount: number,
  paidAmount: number,
  waivedAmount = 0,
): "UNPAID" | "PARTIALLY_PAID" | "PAID" | "WAIVED" => {
  const due = amount - paidAmount - waivedAmount;
  if (due <= 0.01) return waivedAmount > 0 ? "WAIVED" : "PAID";
  if (paidAmount > 0 || waivedAmount > 0) return "PARTIALLY_PAID";
  return "UNPAID";
};

/** Every {year, month} pair from startDate through endDate, inclusive,
 * walked in UTC (Session.startDate/endDate are DATE columns - no time
 * component - so UTC accessors avoid local-timezone drift). Naturally
 * yields an empty list when startDate is after endDate. */
const monthsInRange = (startDate: Date, endDate: Date): Array<{ year: number; month: number }> => {
  const months: Array<{ year: number; month: number }> = [];
  let year = startDate.getUTCFullYear();
  let month = startDate.getUTCMonth() + 1;
  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth() + 1;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};

/** Builds the invoice rows for one student from every active fee structure
 * that applies to their class + session, for use at admission/transfer
 * time. MONTHLY structures fan out into one invoice per month across the
 * session's actual start-end range (which need not be a calendar Jan-Dec
 * year), clamped to never bill before the student's admission/transfer
 * date - so a mid-session transfer never re-bills months the old session
 * already covered. */
const buildAutoInvoiceRows = (
  madrasaId: number,
  studentId: number,
  structures: Array<{ id: number; name: string; amount: any; frequency: string }>,
  session: { startDate: Date; endDate: Date },
  admissionDate: Date,
) => {
  const rows: Array<{
    madrasaId: number;
    studentId: number;
    feeStructureId: number;
    title: string;
    amount: any;
    dueDate: Date;
    month: string | null;
  }> = [];

  const effectiveStart = admissionDate > session.startDate ? admissionDate : session.startDate;

  for (const structure of structures) {
    if (structure.frequency !== "MONTHLY") {
      rows.push({
        madrasaId,
        studentId,
        feeStructureId: structure.id,
        title: structure.name,
        amount: structure.amount,
        dueDate: effectiveStart,
        month: null,
      });
      continue;
    }

    const months = monthsInRange(effectiveStart, session.endDate);
    for (const { year, month } of months) {
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const isFirstMonth = year === effectiveStart.getUTCFullYear() && month === effectiveStart.getUTCMonth() + 1;
      const dueDate = isFirstMonth ? effectiveStart : new Date(Date.UTC(year, month - 1, 10));
      rows.push({
        madrasaId,
        studentId,
        feeStructureId: structure.id,
        title: structure.name,
        amount: structure.amount,
        dueDate,
        month: monthStr,
      });
    }
  }

  return rows;
};

export class FeeService {
  constructor(private readonly repository: FeeRepository = feeRepository) {}

  /** Resolves the Session a request refers to: session_id takes priority;
   * academic_year is accepted as a legacy fallback, matched against an
   * existing Session's name. Mirrors StudentService.resolveSession. */
  private async resolveSession(madrasaId: number, dto: { session_id?: number | string; academic_year?: string }) {
    if (!isEmpty(dto.session_id)) {
      const session = await this.repository.findSessionForTenant(madrasaId, Number(dto.session_id));
      if (!session) throw new BadRequestError("Selected session not found");
      return session;
    }
    if (!isEmpty(dto.academic_year)) {
      const session = await this.repository.findSessionByNameForTenant(madrasaId, String(dto.academic_year));
      if (session) return session;
    }
    throw new BadRequestError("session_id is required");
  }

  /* ================= FEE STRUCTURE ================= */

  async listStructures(madrasaId: number, classId?: number, sessionId?: number, academicYear?: string) {
    try {
      return await this.repository.findStructures(madrasaId, classId, sessionId, academicYear);
    } catch (err) {
      return friendlyFailure("listFeeStructures error:", err, "Failed to load fee structures");
    }
  }

  async createStructure(madrasaId: number, dto: CreateFeeStructureRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.amount) || isEmpty(dto.frequency)) {
      throw new BadRequestError("name, amount and frequency are required");
    }
    if (!FEE_FREQUENCIES.includes(dto.frequency as any)) {
      throw new BadRequestError("frequency must be ONE_TIME, MONTHLY or YEARLY");
    }
    if (dto.fee_type !== undefined && !isEmpty(dto.fee_type) && !FEE_TYPES.includes(dto.fee_type as any)) {
      throw new BadRequestError(`fee_type must be one of: ${FEE_TYPES.join(", ")}`);
    }
    const amount = toAmount(dto.amount, "amount");
    const session = await this.resolveSession(madrasaId, dto);

    try {
      await this.repository.createStructure(madrasaId, {
        classId: dto.class_id ? Number(dto.class_id) : null,
        name: String(dto.name).trim(),
        amount,
        frequency: dto.frequency,
        feeType: isEmpty(dto.fee_type) ? "OTHER" : dto.fee_type,
        sessionId: session.id,
        academicYear: session.name,
      });
    } catch (err) {
      return friendlyFailure("createFeeStructure error:", err, "Failed to create fee structure");
    }
  }

  async updateStructure(id: number, madrasaId: number, dto: UpdateFeeStructureRequestDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = String(dto.name).trim();
    if (dto.amount !== undefined) data.amount = toAmount(dto.amount, "amount");
    if (dto.class_id !== undefined) data.classId = dto.class_id ? Number(dto.class_id) : null;
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);
    if (dto.frequency !== undefined) {
      if (!FEE_FREQUENCIES.includes(dto.frequency as any)) {
        throw new BadRequestError("frequency must be ONE_TIME, MONTHLY or YEARLY");
      }
      data.frequency = dto.frequency;
    }
    if (dto.fee_type !== undefined) {
      if (!FEE_TYPES.includes(dto.fee_type as any)) {
        throw new BadRequestError(`fee_type must be one of: ${FEE_TYPES.join(", ")}`);
      }
      data.feeType = dto.fee_type;
    }
    if (dto.session_id !== undefined || dto.academic_year !== undefined) {
      const session = await this.resolveSession(madrasaId, dto);
      data.sessionId = session.id;
      data.academicYear = session.name;
    }
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updateStructure(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Fee structure not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("updateFeeStructure error:", err, "Failed to update fee structure");
    }
  }

  async deleteStructure(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deleteStructure(id, madrasaId);
      if (!result.count) throw new NotFoundError("Fee structure not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure("deleteFeeStructure error:", err, "Failed to delete fee structure");
    }
  }

  /* ================= INVOICE GENERATION ================= */

  async generateInvoices(madrasaId: number, dto: GenerateInvoicesRequestDto) {
    if (isEmpty(dto.fee_structure_id) || isEmpty(dto.due_date)) {
      throw new BadRequestError("fee_structure_id and due_date are required");
    }

    const structure = await this.repository.findStructureForTenant(
      Number(dto.fee_structure_id),
      madrasaId,
    );
    if (!structure) throw new NotFoundError("Fee structure not found");
    if (!structure.isActive) throw new BadRequestError("This fee structure is inactive");

    if (structure.frequency === "MONTHLY" && isEmpty(dto.month)) {
      throw new BadRequestError('month ("YYYY-MM") is required for a MONTHLY fee structure');
    }

    const classId = dto.class_id ? Number(dto.class_id) : structure.classId;
    if (!classId) {
      throw new BadRequestError(
        "This fee structure applies to no specific class; pass class_id to generate invoices for one",
      );
    }
    const sessionId = !isEmpty(dto.session_id) || !isEmpty(dto.academic_year)
      ? (await this.resolveSession(madrasaId, dto)).id
      : structure.sessionId;

    const dueDate = new Date(dto.due_date);
    if (Number.isNaN(dueDate.getTime())) throw new BadRequestError("due_date is invalid");

    try {
      const students = await this.repository.findStudentsForBilling(madrasaId, classId, sessionId);
      if (students.length === 0) return { created: 0, skipped: 0, totalStudents: 0 };

      const rows = students.map((student) => ({
        madrasaId,
        studentId: student.id,
        feeStructureId: structure.id,
        title: structure.name,
        amount: structure.amount,
        dueDate,
        month: structure.frequency === "MONTHLY" ? String(dto.month) : null,
      }));

      const created = await this.repository.runTransaction((tx) =>
        this.repository.generateInvoicesOnTx(tx, rows),
      );

      return { created, skipped: students.length - created, totalStudents: students.length };
    } catch (err) {
      return friendlyFailure("generateInvoices error:", err, "Failed to generate invoices");
    }
  }

  /** Auto-bills a single student right at admission/transfer: every active
   * fee structure for their class + session is turned into invoice(s)
   * immediately, so office staff no longer has to run "generate" by hand.
   * Safe to call more than once for the same student (e.g. re-admission,
   * session transfer) - the same unique constraint that protects
   * generateInvoices() silently skips anything already billed. Never
   * throws: a billing hiccup must not block admission/transfer, so
   * failures are logged and swallowed by the caller-side convention
   * already used for guardian provisioning. */
  async autoGenerateInvoicesForStudent(
    madrasaId: number,
    studentId: number,
    classId: number,
    sessionId: number,
    admissionDate: Date,
    feeTypes?: string[],
  ) {
    const session = await this.repository.findSessionForTenant(madrasaId, sessionId);
    if (!session) return { created: 0 };

    const structures = await this.repository.findActiveStructuresForBilling(
      madrasaId,
      classId,
      sessionId,
      feeTypes,
    );
    if (structures.length === 0) return { created: 0 };

    const rows = buildAutoInvoiceRows(madrasaId, studentId, structures, session, admissionDate);
    if (rows.length === 0) return { created: 0 };

    const created = await this.repository.runTransaction((tx) =>
      this.repository.generateInvoicesOnTx(tx, rows as any),
    );
    return { created };
  }

  /** "বিদ্যমান সব ছাত্রের ফি সেট করুন" - runs autoGenerateInvoicesForStudent
   * for every currently-enrolled student instead of just newly admitted
   * ones, so installations that already had students before auto-billing
   * existed (or transferred/promoted into a new session) can be backfilled
   * in one click. Per-student failures are counted, not thrown, so one bad
   * student record can't abort billing for the rest of the class. */
  async backfillInvoicesForAllStudents(madrasaId: number, classId?: number, sessionId?: number) {
    const students = await this.repository.findAllActiveStudents(madrasaId, classId, sessionId);

    let studentsProcessed = 0;
    let invoicesCreated = 0;
    let failed = 0;

    for (const student of students) {
      try {
        const result = await this.autoGenerateInvoicesForStudent(
          madrasaId,
          student.id,
          student.classId,
          student.sessionId,
          student.admissionDate ?? new Date(),
        );
        invoicesCreated += result.created;
        studentsProcessed += 1;
      } catch (err) {
        failed += 1;
        logger.error("BACKFILL INVOICES ERROR:", err);
      }
    }

    return { totalStudents: students.length, studentsProcessed, invoicesCreated, failed };
  }

  async listInvoices(madrasaId: number, query: InvoiceQueryDto) {
    const where: Prisma.InvoiceWhereInput = {};
    if (query.student_id) where.studentId = Number(query.student_id);
    if (query.status) where.status = query.status as any;
    if (query.month) where.month = query.month;

    try {
      return await this.repository.findInvoices(madrasaId, where);
    } catch (err) {
      return friendlyFailure("listInvoices error:", err, "Failed to load invoices");
    }
  }

  /** Dedicated "ভর্তি ফি পেন্ডিং" page - every student with an unpaid/
   * partially paid ADMISSION-fee invoice (see findPendingInvoices for why
   * it's scoped to just that fee type). */
  async listPendingInvoices(madrasaId: number, query: PendingInvoicesQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);

    try {
      return await this.repository.findPendingInvoices(madrasaId, limit, offset);
    } catch (err) {
      return friendlyFailure("listPendingInvoices error:", err, "Failed to load pending invoices");
    }
  }

  /** "সব ক্লিয়ার করুন" on the "ভর্তি ফি পেন্ডিং" page - dismisses every row
   * currently on the queue for every office user. Purely a queue-visibility
   * flag (see findPendingInvoices/clearPendingInvoices); the invoices stay
   * exactly as due/collectible as before through ছাত্র ফি গ্রহণ. */
  async clearPendingInvoices(madrasaId: number) {
    try {
      const result = await this.repository.clearPendingInvoices(madrasaId);
      return { cleared: result.count };
    } catch (err) {
      return friendlyFailure("clearPendingInvoices error:", err, "Failed to clear the pending list");
    }
  }

  /* ================= PAYMENTS ================= */

  /** Records a (possibly partial) payment against an invoice, keeps the
   * invoice's paidAmount/status in sync, and mirrors the payment into the
   * existing accounts/income ledger so it shows up in financial reports
   * without any separate manual entry. */
  async recordPayment(
    invoiceId: number,
    madrasaId: number,
    receivedById: number | undefined,
    dto: RecordPaymentRequestDto,
  ) {
    if (isEmpty(dto.amount) || isEmpty(dto.method)) {
      throw new BadRequestError("amount and method are required");
    }
    if (!PAYMENT_METHODS.includes(String(dto.method).toUpperCase() as any)) {
      throw new BadRequestError(`method must be one of: ${PAYMENT_METHODS.join(", ")}`);
    }
    const paymentAmount = toAmount(dto.amount, "amount");

    let paidAt = new Date();
    if (!isEmpty(dto.paid_at)) {
      const parsed = new Date(String(dto.paid_at));
      if (Number.isNaN(parsed.getTime())) throw new BadRequestError("paid_at is invalid");
      if (parsed.getTime() > Date.now() + 60_000) throw new BadRequestError("paid_at cannot be in the future");
      paidAt = parsed;
    }

    let methodLabel: string | null = null;
    if (dto.payment_method_setting_id) {
      const setting = await this.repository.findPaymentMethodSettingForTenant(
        Number(dto.payment_method_setting_id),
        madrasaId,
      );
      if (!setting) throw new NotFoundError("Selected payment method is not set up");
      methodLabel = setting.label;
    }

    let result: {
      paymentId: number;
      invoiceStatus: string;
      paidAmount: number;
      studentId: number;
      dueAmount: number;
    };
    try {
      result = await this.repository.runTransaction(async (tx) => {
        const invoice = await this.repository.findInvoiceForTenantOnTx(tx, invoiceId, madrasaId);
        if (!invoice) throw new NotFoundError("Invoice not found");
        if (invoice.status === "PAID") throw new BadRequestError("This invoice is already fully paid");

        const invoiceAmount = Number(invoice.amount);
        const alreadyPaid = Number(invoice.paidAmount);
        const alreadyWaived = Number(invoice.waivedAmount);
        const remaining = invoiceAmount - alreadyPaid - alreadyWaived;
        if (paymentAmount > remaining + 0.01) {
          throw new BadRequestError(`Payment exceeds the remaining due amount (${remaining})`);
        }

        const newPaidAmount = alreadyPaid + paymentAmount;
        const newStatus = deriveStatus(invoiceAmount, newPaidAmount, alreadyWaived);

        await this.repository.updateInvoiceOnTx(tx, invoiceId, {
          paidAmount: newPaidAmount,
          status: newStatus,
        });

        // Mirror into the general ledger so this payment appears in the
        // existing accounts/income reports too.
        const ledgerEntry = await tx.account.create({
          data: {
            madrasaId,
            type: "income",
            amount: paymentAmount,
            category: FEE_ACCOUNT_CATEGORY,
            fund: FEE_ACCOUNT_FUND,
            description: `Invoice #${invoiceId}: ${invoice.title}`,
            paymentMethod: methodLabel || dto.method,
            entryDate: paidAt,
            createdBy: receivedById ?? null,
          },
        });

        const payment = await this.repository.createPaymentOnTx(tx, {
          madrasaId,
          invoiceId,
          amount: paymentAmount,
          method: String(dto.method).toUpperCase(),
          paidAt,
          receivedById: receivedById ?? null,
          transactionRef: dto.transaction_ref?.trim() || null,
          methodSettingId: dto.payment_method_setting_id ? Number(dto.payment_method_setting_id) : null,
          methodLabel,
          note: dto.note?.trim() || null,
          accountEntryId: ledgerEntry.id,
        });

        return {
          paymentId: payment.id,
          invoiceStatus: newStatus,
          paidAmount: newPaidAmount,
          studentId: invoice.studentId,
          dueAmount: Math.max(invoiceAmount - newPaidAmount - alreadyWaived, 0),
        };
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("recordPayment error:", err, "Failed to record payment");
    }

    // Fire-and-forget: notify the guardian a payment was recorded. Wrapped in
    // its own try/catch, separate from the block above, so a failure here
    // (including the lookup) can never be mistaken for a failed payment -
    // the payment already committed by this point.
    try {
      const student = await studentRepository.findByIdForTenant(result.studentId, madrasaId);
      if (student?.guardianPhone) {
        await notificationService.triggerEvent(madrasaId, "FEE_PAYMENT", student.guardianPhone, {
          name: student.nameBn,
          amount: paymentAmount,
          due: result.dueAmount,
        });
      }
    } catch (err) {
      logger.error("FEE_PAYMENT notification lookup failed:", err);
    }

    return result;
  }

  /** Forgives all or part of the remaining due on an invoice. Route-level
   * rbacMiddleware("fee.waive") with no fallback role already restricts
   * this to MUHTAMIM/SUPER_ADMIN, so no extra role check is needed here. */
  async waiveInvoice(
    invoiceId: number,
    madrasaId: number,
    waivedById: number | undefined,
    dto: WaiveInvoiceRequestDto,
  ) {
    if (isEmpty(dto.amount) || isEmpty(dto.reason)) {
      throw new BadRequestError("amount and reason are required");
    }
    const waiveAmount = toAmount(dto.amount, "amount");

    try {
      return await this.repository.runTransaction(async (tx) => {
        const invoice = await this.repository.findInvoiceForTenantOnTx(tx, invoiceId, madrasaId);
        if (!invoice) throw new NotFoundError("Invoice not found");
        if (invoice.status === "PAID") throw new BadRequestError("This invoice is already fully paid");

        const invoiceAmount = Number(invoice.amount);
        const alreadyPaid = Number(invoice.paidAmount);
        const alreadyWaived = Number(invoice.waivedAmount);

        let newWaivedAmount: number;
        if (dto.mode === "set") {
          // Editing an already-recorded waiver - `amount` is the new total,
          // not an increment on top of it.
          const maxWaivable = invoiceAmount - alreadyPaid;
          if (waiveAmount > maxWaivable + 0.01) {
            throw new BadRequestError(`মওকুফের পরিমাণ চালানের বাকি টাকার (${maxWaivable}) চেয়ে বেশি হতে পারবে না`);
          }
          newWaivedAmount = waiveAmount;
        } else {
          const remaining = invoiceAmount - alreadyPaid - alreadyWaived;
          if (waiveAmount > remaining + 0.01) {
            throw new BadRequestError(`Waiver exceeds the remaining due amount (${remaining})`);
          }
          newWaivedAmount = alreadyWaived + waiveAmount;
        }

        const newStatus = deriveStatus(invoiceAmount, alreadyPaid, newWaivedAmount);

        await this.repository.updateInvoiceOnTx(tx, invoiceId, {
          waivedAmount: newWaivedAmount,
          waiveReason: dto.reason.trim(),
          waivedById: waivedById ?? null,
          waivedAt: new Date(),
          status: newStatus,
        });

        return { invoiceStatus: newStatus, waivedAmount: newWaivedAmount };
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("waiveInvoice error:", err, "Failed to waive invoice");
    }
  }

  /* ================= STUDENT ACCOUNT STATEMENT ================= */

  async getStudentStatement(madrasaId: number, studentId: number) {
    try {
      const invoices = await this.repository.findStatementForStudent(madrasaId, studentId);

      let totalBilled = 0;
      let totalPaid = 0;
      let totalWaived = 0;
      for (const invoice of invoices) {
        totalBilled += Number(invoice.amount);
        totalPaid += Number(invoice.paidAmount);
        totalWaived += Number(invoice.waivedAmount);
      }

      return {
        invoices,
        summary: {
          totalBilled,
          totalPaid,
          totalWaived,
          totalDue: totalBilled - totalPaid - totalWaived,
        },
      };
    } catch (err) {
      return friendlyFailure("getStudentStatement error:", err, "Failed to load account statement");
    }
  }

  /* ================= MANUAL PAYMENT METHOD SETUP ================= */

  async listPaymentMethodSettings(madrasaId: number, activeOnly = false) {
    try {
      return await this.repository.findPaymentMethodSettings(madrasaId, activeOnly);
    } catch (err) {
      return friendlyFailure(
        "listPaymentMethodSettings error:",
        err,
        "Failed to load payment methods",
      );
    }
  }

  async createPaymentMethodSetting(madrasaId: number, dto: CreatePaymentMethodSettingRequestDto) {
    if (isEmpty(dto.method_type) || isEmpty(dto.label)) {
      throw new BadRequestError("method_type and label are required");
    }
    if (!PAYMENT_METHOD_TYPES.includes(dto.method_type.toUpperCase() as any)) {
      throw new BadRequestError(`method_type must be one of: ${PAYMENT_METHOD_TYPES.join(", ")}`);
    }

    try {
      await this.repository.createPaymentMethodSetting(madrasaId, {
        methodType: dto.method_type.toUpperCase(),
        label: dto.label.trim(),
        accountName: dto.account_name?.trim() || null,
        accountNumber: dto.account_number?.trim() || null,
        bankName: dto.bank_name?.trim() || null,
        branch: dto.branch?.trim() || null,
        instructions: dto.instructions?.trim() || null,
      });
    } catch (err) {
      return friendlyFailure(
        "createPaymentMethodSetting error:",
        err,
        "Failed to create payment method",
      );
    }
  }

  async updatePaymentMethodSetting(
    id: number,
    madrasaId: number,
    dto: UpdatePaymentMethodSettingRequestDto,
  ) {
    const data: Record<string, unknown> = {};
    if (dto.method_type !== undefined) {
      if (!PAYMENT_METHOD_TYPES.includes(dto.method_type.toUpperCase() as any)) {
        throw new BadRequestError(`method_type must be one of: ${PAYMENT_METHOD_TYPES.join(", ")}`);
      }
      data.methodType = dto.method_type.toUpperCase();
    }
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.account_name !== undefined) data.accountName = dto.account_name?.trim() || null;
    if (dto.account_number !== undefined) data.accountNumber = dto.account_number?.trim() || null;
    if (dto.bank_name !== undefined) data.bankName = dto.bank_name?.trim() || null;
    if (dto.branch !== undefined) data.branch = dto.branch?.trim() || null;
    if (dto.instructions !== undefined) data.instructions = dto.instructions?.trim() || null;
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      const result = await this.repository.updatePaymentMethodSetting(id, madrasaId, data);
      if (!result.count) throw new NotFoundError("Payment method not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure(
        "updatePaymentMethodSetting error:",
        err,
        "Failed to update payment method",
      );
    }
  }

  async deletePaymentMethodSetting(id: number, madrasaId: number) {
    try {
      const result = await this.repository.deletePaymentMethodSetting(id, madrasaId);
      if (!result.count) throw new NotFoundError("Payment method not found");
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      return friendlyFailure(
        "deletePaymentMethodSetting error:",
        err,
        "Failed to delete payment method",
      );
    }
  }
}

export const feeService = new FeeService();
