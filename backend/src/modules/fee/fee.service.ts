import { Prisma } from "@prisma/client";
import { ApiError, BadRequestError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { feeRepository, FeeRepository } from "./fee.repository";
import { studentRepository } from "../students/student.repository";
import { notificationService } from "../notifications/notification.service";
import { accountService } from "../accounts/account.service";
import { logActivity } from "../../shared/utils/activity.util";
import {
  CreateFeeCategoryRequestDto,
  CreateFeeStructureRequestDto,
  CreatePaymentMethodSettingRequestDto,
  DeleteAllInvoicesRequestDto,
  InvoiceQueryDto,
  OverdueFeesQueryDto,
  PendingInvoicesQueryDto,
  RecordPaymentRequestDto,
  SetStudentFeeDiscountRequestDto,
  UpdateFeeCategoryRequestDto,
  UpdateFeeStructureRequestDto,
  UpdatePaymentMethodSettingRequestDto,
  WaiveInvoiceRequestDto,
} from "./fee.dto";
import {
  DEFAULT_FEE_CATEGORY_NAME,
  FEE_FREQUENCIES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_TYPES,
} from "./fee.constants";

const isEmpty = (value: unknown) =>
  value === undefined || value === null || String(value).trim() === "";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const toAmount = (value: unknown, label: string): number => {
  const amount = Number(value);
  if (Number.isNaN(amount) || amount <= 0)
    throw new BadRequestError(`${label} must be a positive number`);
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
 * time and by the daily current-month billing scheduler (see
 * generateCurrentMonthInvoices below). MONTHLY structures fan out into one
 * invoice per month, clamped on both ends:
 *  - never before the student's admission/transfer date, so a mid-session
 *    transfer never re-bills months the old session already covered;
 *  - PURE "BILL-AS-YOU-GO" (Option A): never past `today`, so approving an
 *    admission (or any other call site) can only ever create invoices for
 *    months that have actually started. "বকেয়া" (due) can therefore never
 *    include a month that hasn't arrived yet. Months after `today` are
 *    intentionally left ungenerated - they get created automatically, one
 *    at a time, by generateCurrentMonthInvoices() as each real month
 *    begins. This also makes re-running the same call later (e.g. the
 *    "বিদ্যমান সব ছাত্রের ফি সেট করুন" backfill) naturally top up any
 *    months that have since elapsed, since generateInvoicesOnTx skips
 *    whatever already exists. */
/** A standing discount (see StudentFeeDiscount) for one fee structure,
 * applied to every invoice buildAutoInvoiceRows generates for it - both at
 * admission approval and by the recurring monthly scheduler - so a
 * discount set once keeps applying for as long as the fee is billed. */
type FeeDiscount = { waivedAmount: number; reason: string; setById: number | null };

const applyDiscount = (
  row: { amount: any },
  discount: FeeDiscount | undefined,
): { waivedAmount: number; waiveReason: string | null; waivedById: number | null; waivedAt: Date | null; status: ReturnType<typeof deriveStatus> } => {
  if (!discount) {
    return { waivedAmount: 0, waiveReason: null, waivedById: null, waivedAt: null, status: "UNPAID" };
  }
  const waivedAmount = Math.min(discount.waivedAmount, Number(row.amount));
  return {
    waivedAmount,
    waiveReason: discount.reason,
    waivedById: discount.setById,
    waivedAt: new Date(),
    status: deriveStatus(Number(row.amount), 0, waivedAmount),
  };
};

const buildAutoInvoiceRows = (
  madrasaId: number,
  studentId: number,
  structures: Array<{ id: number; name: string; amount: any; frequency: string }>,
  session: { startDate: Date; endDate: Date },
  admissionDate: Date,
  today: Date = new Date(),
  discountsByStructureId: Map<number, FeeDiscount> = new Map(),
) => {
  const rows: Array<{
    madrasaId: number;
    studentId: number;
    feeStructureId: number;
    title: string;
    amount: any;
    dueDate: Date;
    month: string | null;
    waivedAmount: number;
    waiveReason: string | null;
    waivedById: number | null;
    waivedAt: Date | null;
    status: ReturnType<typeof deriveStatus>;
  }> = [];

  const effectiveStart = admissionDate > session.startDate ? admissionDate : session.startDate;
  const billableEnd = session.endDate < today ? session.endDate : today;

  for (const structure of structures) {
    const discount = discountsByStructureId.get(structure.id);

    if (structure.frequency !== "MONTHLY") {
      // ONE_TIME/YEARLY fees (admission fee, exam fee, etc.) are still
      // billed in full immediately - only recurring MONTHLY fees get the
      // bill-as-you-go treatment, since those are what compounded into a
      // full year's worth of premature "due" before this change.
      rows.push({
        madrasaId,
        studentId,
        feeStructureId: structure.id,
        title: structure.name,
        amount: structure.amount,
        dueDate: effectiveStart,
        month: null,
        ...applyDiscount({ amount: structure.amount }, discount),
      });
      continue;
    }

    if (effectiveStart > billableEnd) continue; // nothing billable has started yet

    const months = monthsInRange(effectiveStart, billableEnd);
    for (const { year, month } of months) {
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const isFirstMonth =
        year === effectiveStart.getUTCFullYear() && month === effectiveStart.getUTCMonth() + 1;
      const dueDate = isFirstMonth ? effectiveStart : new Date(Date.UTC(year, month - 1, 10));
      rows.push({
        madrasaId,
        studentId,
        feeStructureId: structure.id,
        title: structure.name,
        amount: structure.amount,
        dueDate,
        month: monthStr,
        ...applyDiscount({ amount: structure.amount }, discount),
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
  private async resolveSession(
    madrasaId: number,
    dto: { session_id?: number | string; academic_year?: string },
  ) {
    if (!isEmpty(dto.session_id)) {
      const session = await this.repository.findSessionForTenant(madrasaId, Number(dto.session_id));
      if (!session) throw new BadRequestError("Selected session not found");
      return session;
    }
    if (!isEmpty(dto.academic_year)) {
      const session = await this.repository.findSessionByNameForTenant(
        madrasaId,
        String(dto.academic_year),
      );
      if (session) return session;
    }
    throw new BadRequestError("session_id is required");
  }

  /* ================= FEE STRUCTURE ================= */

  async listStructures(
    madrasaId: number,
    classId?: number,
    sessionId?: number,
    academicYear?: string,
  ) {
    try {
      return await this.repository.findStructures(madrasaId, classId, sessionId, academicYear);
    } catch (err) {
      return friendlyFailure("listFeeStructures error:", err, "Failed to load fee structures");
    }
  }

  /** Backs the "যুক্ত পরীক্ষা" picker on the ফি কাঠামো form - see
   * FeeRepository.findExamsForTenant for why this is its own fee-scoped
   * lookup rather than reusing GET /exams. */
  async listExamsForFeeLinking(madrasaId: number) {
    try {
      return await this.repository.findExamsForTenant(madrasaId);
    } catch (err) {
      return friendlyFailure("listExamsForFeeLinking error:", err, "Failed to load exams");
    }
  }

  /** Validates that `examId` (if given) belongs to this tenant, resolving it
   * to a plain number (or null when omitted/cleared). Shared by
   * createStructure/updateStructure - see FeeStructure.examId. */
  private async resolveExamId(
    madrasaId: number,
    examId: CreateFeeStructureRequestDto["exam_id"],
  ): Promise<number | null> {
    if (isEmpty(examId)) return null;
    const id = Number(examId);
    const exams = await this.repository.findExamsForTenant(madrasaId);
    if (!exams.some((e) => e.id === id)) {
      throw new BadRequestError("নির্বাচিত পরীক্ষা খুঁজে পাওয়া যায়নি");
    }
    return id;
  }

  async createStructure(madrasaId: number, dto: CreateFeeStructureRequestDto) {
    if (isEmpty(dto.name) || isEmpty(dto.amount) || isEmpty(dto.frequency)) {
      throw new BadRequestError("name, amount and frequency are required");
    }
    if (!FEE_FREQUENCIES.includes(dto.frequency as any)) {
      throw new BadRequestError("frequency must be ONE_TIME, MONTHLY or YEARLY");
    }
    const amount = toAmount(dto.amount, "amount");
    const session = await this.resolveSession(madrasaId, dto);
    const examId = await this.resolveExamId(madrasaId, dto.exam_id);

    try {
      await this.repository.createStructure(madrasaId, {
        classId: dto.class_id ? Number(dto.class_id) : null,
        name: String(dto.name).trim(),
        amount,
        frequency: dto.frequency,
        feeType: isEmpty(dto.fee_type) ? DEFAULT_FEE_CATEGORY_NAME : String(dto.fee_type).trim(),
        sessionId: session.id,
        academicYear: session.name,
        examId,
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
      data.feeType = isEmpty(dto.fee_type) ? DEFAULT_FEE_CATEGORY_NAME : String(dto.fee_type).trim();
    }
    if (dto.session_id !== undefined || dto.academic_year !== undefined) {
      const session = await this.resolveSession(madrasaId, dto);
      data.sessionId = session.id;
      data.academicYear = session.name;
    }
    if (dto.exam_id !== undefined) {
      data.examId = await this.resolveExamId(madrasaId, dto.exam_id);
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

  /* ================= ফি ধরণ (FeeCategory) ================= */

  /** Every ফি ধরণ for this tenant (active + inactive, for the settings
   * page) - lazily seeds the starter picklist (see fee.constants.ts
   * FEE_CATEGORY_DEFAULTS) the first time a tenant has none yet, same "seed
   * once, then let the admin freely edit" pattern as
   * AccountService.getOptions/seedDefaultFunds. */
  async getCategories(madrasaId: number) {
    try {
      const count = await this.repository.countCategories(madrasaId);
      if (count === 0) await this.repository.seedDefaultCategories(madrasaId);
      return await this.repository.findCategories(madrasaId);
    } catch (err) {
      return friendlyFailure("getFeeCategories error:", err, "Failed to load fee categories");
    }
  }

  /** Active category names flagged isAdmissionType - replaces the old
   * hardcoded feeType === "ADMISSION" checks (see FeeCategory in
   * fee.prisma). Goes through getCategories() first so a tenant that has
   * never opened ফি ধরণ সেটিংস still gets the starter picklist seeded (and
   * therefore still bills its ভর্তি ফি at admission submission)
   * automatically. */
  async getAdmissionCategoryNames(madrasaId: number) {
    await this.getCategories(madrasaId);
    return this.repository.findAdmissionCategoryNames(madrasaId);
  }

  async createCategory(madrasaId: number, dto: CreateFeeCategoryRequestDto) {
    const name = String(dto.name || "").trim();
    if (!name) throw new BadRequestError("নাম দিন");

    try {
      const count = await this.repository.countCategories(madrasaId);
      await this.repository.createCategory({
        madrasaId,
        name,
        isAdmissionType: Boolean(dto.is_admission_type),
        sortOrder: count,
      });
    } catch (err) {
      return friendlyFailure("createFeeCategory error:", err, "Failed to create fee category");
    }
  }

  async updateCategory(id: number, madrasaId: number, dto: UpdateFeeCategoryRequestDto) {
    const existing = await this.repository.findCategoryForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError("Fee category not found");

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const name = String(dto.name).trim();
      if (!name) throw new BadRequestError("নাম দিন");
      data.name = name;
    }
    if (dto.is_admission_type !== undefined) data.isAdmissionType = Boolean(dto.is_admission_type);
    if (dto.sort_order !== undefined) data.sortOrder = Number(dto.sort_order);
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    try {
      await this.repository.updateCategory(id, data);
      // Turning a ফি ধরণ off/on should also stop/resume billing for every
      // FeeStructure already using it - not just hide it from the picklist
      // (see FeeRepository.updateStructuresActiveByFeeType).
      if (data.isActive !== undefined) {
        await this.repository.updateStructuresActiveByFeeType(
          madrasaId,
          existing.name,
          data.isActive as boolean,
        );
      }
    } catch (err) {
      return friendlyFailure("updateFeeCategory error:", err, "Failed to update fee category");
    }
  }

  async deleteCategory(id: number, madrasaId: number) {
    const existing = await this.repository.findCategoryForTenant(id, madrasaId);
    if (!existing) throw new NotFoundError("Fee category not found");

    try {
      await this.repository.deleteCategory(id);
    } catch (err) {
      return friendlyFailure("deleteFeeCategory error:", err, "Failed to delete fee category");
    }
  }

  /* ================= INVOICE GENERATION ================= */

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
    includeExamLinked = false,
  ) {
    const session = await this.repository.findSessionForTenant(madrasaId, sessionId);
    if (!session) return { created: 0 };

    const structures = await this.repository.findActiveStructuresForBilling(
      madrasaId,
      classId,
      sessionId,
      feeTypes,
      includeExamLinked,
    );
    if (structures.length === 0) return { created: 0 };

    const discounts = await this.repository.findDiscountsForStudent(madrasaId, studentId);
    const discountsByStructureId = new Map(
      discounts.map((d) => [
        d.feeStructureId,
        { waivedAmount: Number(d.waivedAmount), reason: d.reason, setById: d.setById },
      ]),
    );

    const rows = buildAutoInvoiceRows(
      madrasaId,
      studentId,
      structures,
      session,
      admissionDate,
      undefined,
      discountsByStructureId,
    );
    if (rows.length === 0) return { created: 0 };

    const created = await this.repository.runTransaction((tx) =>
      this.repository.generateInvoicesOnTx(tx, rows as any),
    );
    return { created };
  }

  /* ================= PRE-APPROVAL FEE PREVIEW & DISCOUNTS ================= */

  /** The determined fee list for one student's class/session - every active
   * FeeStructure that would get billed by autoGenerateInvoicesForStudent,
   * merged with any standing StudentFeeDiscount already set for it. Used by
   * the "পেন্ডিং ভর্তি অনুমোদন" page so a Muhtamim can see (and waive/reduce)
   * what a pending applicant will owe before ever approving them - no
   * Invoice rows exist yet at that point (see StudentService.approveAdmission). */
  async previewStudentFees(madrasaId: number, studentId: number) {
    const student = await studentRepository.findByIdForTenant(studentId, madrasaId);
    if (!student) throw new NotFoundError("Student not found");

    // includeExamLinked: true - this is an informational preview shown
    // before approval, so a পরীক্ষার ফি tied to a specific exam is still
    // worth showing even though it won't actually be billed at approval
    // (see autoGenerateInvoicesForStudent, which defaults to excluding it).
    const structures = await this.repository.findActiveStructuresForBilling(
      madrasaId,
      student.classId,
      student.sessionId,
      undefined,
      true,
    );
    const discounts = await this.repository.findDiscountsForStudent(madrasaId, studentId);
    const discountByStructureId = new Map(discounts.map((d) => [d.feeStructureId, d]));

    return structures.map((structure) => {
      const discount = discountByStructureId.get(structure.id);
      return {
        feeStructureId: structure.id,
        name: structure.name,
        feeType: structure.feeType,
        frequency: structure.frequency,
        amount: Number(structure.amount),
        waivedAmount: discount ? Number(discount.waivedAmount) : 0,
        reason: discount?.reason ?? null,
        examLinked: structure.examId != null,
      };
    });
  }

  /** Sets (amount > 0) or removes (amount 0) a standing discount against one
   * fee structure for a pending applicant - see buildAutoInvoiceRows, which
   * applies it to every invoice generated for that student+structure from
   * here on, including future MONTHLY invoices from the daily scheduler.
   * Deliberately scoped to PENDING admissions only: an already-approved
   * student's existing invoices are waived one at a time via
   * FeeService.waiveInvoice instead, which this intentionally does not
   * touch. */
  async setStudentFeeDiscount(
    madrasaId: number,
    studentId: number,
    feeStructureId: number,
    dto: SetStudentFeeDiscountRequestDto,
    setById: number | undefined,
  ) {
    const student = await studentRepository.findByIdForTenant(studentId, madrasaId);
    if (!student) throw new NotFoundError("Student not found");
    if (student.admissionStatus !== "PENDING") {
      throw new BadRequestError("এই সুবিধা শুধুমাত্র পেন্ডিং ভর্তির জন্য প্রযোজ্য");
    }

    const structures = await this.repository.findActiveStructuresForBilling(
      madrasaId,
      student.classId,
      student.sessionId,
      undefined,
      true,
    );
    if (!structures.some((s) => s.id === feeStructureId)) {
      throw new BadRequestError("এই ছাত্রের জন্য এই ফি প্রযোজ্য নয়");
    }

    const amount = Number(dto.amount);
    if (Number.isNaN(amount) || amount < 0) throw new BadRequestError("সঠিক পরিমাণ দিন");
    if (amount > 0 && !dto.reason?.trim()) throw new BadRequestError("কারণ লিখুন");

    await this.repository.upsertStudentFeeDiscount(
      madrasaId,
      studentId,
      feeStructureId,
      amount,
      dto.reason?.trim() || "",
      setById,
    );

    return this.previewStudentFees(madrasaId, studentId);
  }

  /** "বিদ্যমান সব ছাত্রের ফি সেট করুন" - runs autoGenerateInvoicesForStudent
   * for every currently-enrolled student instead of just newly admitted
   * ones, so installations that already had students before auto-billing
   * existed (or transferred/promoted into a new session) can be backfilled
   * in one click. Per-student failures are counted, not thrown, so one bad
   * student record can't abort billing for the rest of the class.
   *
   * includeExamLinked: true - this is also what actually bills a পরীক্ষার ফি
   * tied to a specific exam (see FeeStructure.examId): it runs automatically
   * right after such a structure is created (see FeeStructurePage.tsx) and
   * can be re-run any time office staff decides the exam is now upcoming, so
   * this explicit action is the intended trigger point instead of the
   * automatic admission-approval billing (which always excludes it). */
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
          undefined,
          true,
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

  /** The other half of "pure Option A": runs once a day (see
   * startCurrentMonthInvoiceScheduler in core/bootstrap.ts) and bills every
   * currently-enrolled student, across every tenant, for whichever MONTHLY
   * fees have just become due for the calendar month `today` falls in.
   * ONE_TIME/YEARLY fees are untouched here - those are already billed in
   * full at admission time (see buildAutoInvoiceRows).
   *
   * Deliberately a single cross-tenant query up front (findActiveStudents
   * ForCurrentMonthBilling), same shape as TrashRepository.purgeExpired,
   * rather than looping madrasa-by-madrasa - there's no per-tenant
   * scheduling concern here, just a platform-wide "did the calendar roll
   * over" check.
   *
   * Idempotent and safe to run more than once for the same day/month:
   * generateInvoicesOnTx silently skips any (student, feeStructure, month)
   * that already exists, so a re-run (e.g. after a server restart) never
   * double-bills. Grouped by class+session so one session lookup and one
   * fee-structure lookup is shared across every student in that group
   * instead of querying per student - but each student still gets their
   * OWN transaction (see the inner loop below). Batching every student's
   * rows into one shared transaction was tried first and is wrong: Prisma
   * interactive transactions have a short default timeout (5s), and once
   * a group has more than a handful of students the sequential
   * findFirst-then-create per row blows past it, so the transaction gets
   * closed by Prisma mid-way and every row after that fails with
   * "Transaction not found / refers to an old closed transaction" - which
   * is the exact error this fixes. Per-student failures (including a
   * timeout on one unusually large student) are counted, not thrown, so
   * one bad student can't block billing for the rest of the group/platform. */
  async generateCurrentMonthInvoices(today: Date = new Date()) {
    const students = await this.repository.findActiveStudentsForCurrentMonthBilling(today);

    const groups = new Map<
      string,
      { madrasaId: number; classId: number; sessionId: number; students: typeof students }
    >();
    for (const student of students) {
      const key = `${student.madrasaId}:${student.classId}:${student.sessionId}`;
      const group = groups.get(key);
      if (group) group.students.push(student);
      else
        groups.set(key, {
          madrasaId: student.madrasaId,
          classId: student.classId,
          sessionId: student.sessionId,
          students: [student],
        });
    }

    let invoicesCreated = 0;
    let groupsFailed = 0;
    let studentsFailed = 0;

    for (const group of groups.values()) {
      let session: Awaited<ReturnType<FeeRepository["findSessionForTenant"]>>;
      let structures: Array<{ id: number; name: string; amount: any; frequency: string }>;
      try {
        session = await this.repository.findSessionForTenant(group.madrasaId, group.sessionId);
        if (!session) continue;

        structures = (
          await this.repository.findActiveStructuresForBilling(
            group.madrasaId,
            group.classId,
            group.sessionId,
          )
        ).filter((s) => s.frequency === "MONTHLY");
        if (structures.length === 0) continue;
      } catch (err) {
        groupsFailed += 1;
        logger.error("CURRENT-MONTH INVOICE GENERATION ERROR (group lookup):", err);
        continue;
      }

      // One transaction PER STUDENT (a handful of rows, fast) - never one
      // transaction for the whole group (see the doc comment above for why).
      for (const student of group.students) {
        let discountsByStructureId: Map<number, FeeDiscount>;
        try {
          const discounts = await this.repository.findDiscountsForStudent(group.madrasaId, student.id);
          discountsByStructureId = new Map(
            discounts.map((d) => [
              d.feeStructureId,
              { waivedAmount: Number(d.waivedAmount), reason: d.reason, setById: d.setById },
            ]),
          );
        } catch (err) {
          studentsFailed += 1;
          logger.error("CURRENT-MONTH INVOICE GENERATION ERROR (discount lookup):", err);
          continue;
        }

        const rows = buildAutoInvoiceRows(
          group.madrasaId,
          student.id,
          structures,
          session,
          student.admissionDate ?? session.startDate,
          today,
          discountsByStructureId,
        );
        if (rows.length === 0) continue;

        try {
          invoicesCreated += await this.repository.runTransaction((tx) =>
            this.repository.generateInvoicesOnTx(tx, rows as any),
          );
        } catch (err) {
          studentsFailed += 1;
          logger.error("CURRENT-MONTH INVOICE GENERATION ERROR (student):", err);
        }
      }
    }

    return { studentsChecked: students.length, invoicesCreated, groupsFailed, studentsFailed };
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

  /** Dedicated "বকেয়া ফী" management page - every student with at least one
   * overdue invoice (any fee type), grouped so office staff sees one row per
   * student with their total due instead of hunting through invoices one by
   * one. Sorted by total due, largest first. */
  async listOverdueFees(madrasaId: number, query: OverdueFeesQueryDto) {
    const classId = query.class_id ? Number(query.class_id) : undefined;

    try {
      const invoices = await this.repository.findOverdueInvoices(madrasaId, classId, query.search);

      const byStudent = new Map<
        number,
        {
          studentId: number;
          studentName: string;
          roll: number | null;
          registrationNo: number | null;
          className: string | null;
          guardianPhone: string | null;
          totalDue: number;
          invoiceCount: number;
          oldestDueDate: Date;
          invoices: Array<{
            id: number;
            title: string;
            dueDate: Date;
            month: string | null;
            remaining: number;
          }>;
        }
      >();

      for (const invoice of invoices) {
        const remaining =
          Number(invoice.amount) - Number(invoice.paidAmount) - Number(invoice.waivedAmount || 0);
        const row = {
          id: invoice.id,
          title: invoice.title,
          dueDate: invoice.dueDate,
          month: invoice.month,
          remaining,
        };

        const existing = byStudent.get(invoice.studentId);
        if (existing) {
          existing.totalDue += remaining;
          existing.invoiceCount += 1;
          existing.invoices.push(row);
          if (invoice.dueDate < existing.oldestDueDate) existing.oldestDueDate = invoice.dueDate;
        } else {
          byStudent.set(invoice.studentId, {
            studentId: invoice.studentId,
            studentName: invoice.student.nameBn,
            roll: invoice.student.roll,
            registrationNo: invoice.student.registrationNo,
            className: invoice.student.classRef?.nameBn || null,
            guardianPhone: invoice.student.guardianPhone,
            totalDue: remaining,
            invoiceCount: 1,
            oldestDueDate: invoice.dueDate,
            invoices: [row],
          });
        }
      }

      const students = Array.from(byStudent.values()).sort((a, b) => b.totalDue - a.totalDue);
      const totalDue = students.reduce((sum, s) => sum + s.totalDue, 0);

      return { students, studentCount: students.length, invoiceCount: invoices.length, totalDue };
    } catch (err) {
      return friendlyFailure("listOverdueFees error:", err, "Failed to load overdue fees");
    }
  }

  /** Dedicated "ভর্তি ফি পেন্ডিং" page - every student with an unpaid/
   * partially paid admission-fee invoice (see findPendingInvoices for why
   * it's scoped to just that fee type). */
  async listPendingInvoices(madrasaId: number, query: PendingInvoicesQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);

    try {
      const admissionFeeTypes = await this.getAdmissionCategoryNames(madrasaId);
      return await this.repository.findPendingInvoices(madrasaId, limit, offset, admissionFeeTypes);
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
      const admissionFeeTypes = await this.getAdmissionCategoryNames(madrasaId);
      const result = await this.repository.clearPendingInvoices(madrasaId, admissionFeeTypes);
      return { cleared: result.count };
    } catch (err) {
      return friendlyFailure(
        "clearPendingInvoices error:",
        err,
        "Failed to clear the pending list",
      );
    }
  }

  /** Wipes every invoice (and, via cascade, every payment) for this tenant
   * - meant for clearing out test/demo data before real use, never for
   * routine cleanup. Gated on a typed "DELETE" confirmation independent of
   * whatever the frontend already asked, since this is irreversible. */
  async deleteAllInvoices(madrasaId: number, dto: DeleteAllInvoicesRequestDto) {
    if (dto.confirm !== "DELETE") {
      throw new BadRequestError('Type "DELETE" to confirm this irreversible action');
    }
    try {
      const result = await this.repository.deleteAllInvoices(madrasaId);
      return { deleted: result.count };
    } catch (err) {
      return friendlyFailure("deleteAllInvoices error:", err, "Failed to delete invoices");
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
      if (parsed.getTime() > Date.now() + 60_000)
        throw new BadRequestError("paid_at cannot be in the future");
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

    // ফান্ড ও খাত সেটিংসে বাস্তবে যা আছে তা থেকেই নেওয়া হয় (প্রথম আয় ফান্ড ও
    // তার প্রথম খাত) - হার্ডকোড করা কোনো ফান্ড/খাত নাম ব্যবহার হয় না, তাই
    // অ্যাডমিন সেটিংসে ফান্ড রিনেম/পুনর্বিন্যাস করলে এখানেও তা প্রতিফলিত হয়।
    const { incomeFunds } = await accountService.getOptions(madrasaId);
    const feeFund = incomeFunds[0]?.name;
    const feeCategory = incomeFunds[0]?.categories[0];
    if (!feeFund || !feeCategory) {
      throw new BadRequestError(
        "হিসাব বিভাগে কোনো আয় ফান্ড/খাত সেটআপ করা নেই - প্রথমে ফান্ড ও খাত সেটিংসে একটি যোগ করুন",
      );
    }

    let result: {
      paymentId: number;
      invoiceStatus: string;
      paidAmount: number;
      studentId: number;
      dueAmount: number;
      invoiceTitle: string;
    };
    try {
      result = await this.repository.runTransaction(async (tx) => {
        const invoice = await this.repository.findInvoiceForTenantOnTx(tx, invoiceId, madrasaId);
        if (!invoice) throw new NotFoundError("Invoice not found");
        if (invoice.status === "PAID")
          throw new BadRequestError("This invoice is already fully paid");

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
            category: feeCategory,
            fund: feeFund,
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
          methodSettingId: dto.payment_method_setting_id
            ? Number(dto.payment_method_setting_id)
            : null,
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
          invoiceTitle: invoice.title,
        };
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("recordPayment error:", err, "Failed to record payment");
    }

    // Fire-and-forget: notify the guardian and write the activity log entry.
    // Wrapped in its own try/catch, separate from the block above, so a
    // failure here (including the lookup) can never be mistaken for a
    // failed payment - the payment already committed by this point.
    try {
      const student = await studentRepository.findByIdForTenant(result.studentId, madrasaId);
      if (student?.guardianPhone) {
        await notificationService.triggerEvent(madrasaId, "FEE_PAYMENT", student.guardianPhone, {
          name: student.nameBn,
          amount: paymentAmount,
          due: result.dueAmount,
        });
      }
      if (student) {
        // Hand-logged (not the generic body-field auto-logger - see
        // SELF_LOGGED_ENTITY_PATHS in activityLogger.middleware.ts) so the
        // details column carries the paying student's id/name/class instead
        // of just the invoice id.
        await logActivity({
          madrasa_id: madrasaId,
          user_id: receivedById ?? null,
          action: "CREATE",
          entity: "invoices/pay",
          entity_id: invoiceId,
          details: `ছাত্র আইডি: ${student.id}, নাম: ${student.nameBn}, শ্রেণি: ${student.classRef?.nameBn || "অজানা"} — ইনভয়েস #${invoiceId} (${result.invoiceTitle}) এর জন্য ${paymentAmount} টাকা পরিশোধ করা হয়েছে, পদ্ধতি: ${methodLabel || dto.method}`,
        });
      }
    } catch (err) {
      logger.error("FEE_PAYMENT notification/activity log failed:", err);
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

    let result: { invoiceStatus: string; waivedAmount: number; studentId: number; invoiceTitle: string };
    try {
      result = await this.repository.runTransaction(async (tx) => {
        const invoice = await this.repository.findInvoiceForTenantOnTx(tx, invoiceId, madrasaId);
        if (!invoice) throw new NotFoundError("Invoice not found");
        if (invoice.status === "PAID")
          throw new BadRequestError("This invoice is already fully paid");

        const invoiceAmount = Number(invoice.amount);
        const alreadyPaid = Number(invoice.paidAmount);
        const alreadyWaived = Number(invoice.waivedAmount);

        let newWaivedAmount: number;
        if (dto.mode === "set") {
          // Editing an already-recorded waiver - `amount` is the new total,
          // not an increment on top of it.
          const maxWaivable = invoiceAmount - alreadyPaid;
          if (waiveAmount > maxWaivable + 0.01) {
            throw new BadRequestError(
              `মওকুফের পরিমাণ চালানের বাকি টাকার (${maxWaivable}) চেয়ে বেশি হতে পারবে না`,
            );
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

        return {
          invoiceStatus: newStatus,
          waivedAmount: newWaivedAmount,
          studentId: invoice.studentId,
          invoiceTitle: invoice.title,
        };
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
      return friendlyFailure("waiveInvoice error:", err, "Failed to waive invoice");
    }

    // Hand-logged (not the generic body-field auto-logger - see
    // SELF_LOGGED_ENTITY_PATHS in activityLogger.middleware.ts) so the
    // details column carries the student's id/name/class instead of just
    // the invoice id. Non-fatal - the waiver already committed above.
    try {
      const student = await studentRepository.findByIdForTenant(result.studentId, madrasaId);
      if (student) {
        await logActivity({
          madrasa_id: madrasaId,
          user_id: waivedById ?? null,
          action: "CREATE",
          entity: "invoices/waive",
          entity_id: invoiceId,
          details: `ছাত্র আইডি: ${student.id}, নাম: ${student.nameBn}, শ্রেণি: ${student.classRef?.nameBn || "অজানা"} — ইনভয়েস #${invoiceId} (${result.invoiceTitle}) থেকে ${waiveAmount} টাকা মওকুফ করা হয়েছে (মোট মওকুফ: ${result.waivedAmount} টাকা), কারণ: ${dto.reason.trim()}`,
        });
      }
    } catch (err) {
      logger.error("Activity log for invoice waiver failed:", err);
    }

    return result;
  }

  /* ================= DASHBOARD SUMMARY ================= */

  /** Aggregate stats for the ফি ব্যবস্থাপনা module's own dashboard - invoiced/
   * collected/due totals, a status breakdown, overdue exposure and a
   * 12-month collection trend. Separate from the tenant-wide GET /dashboard
   * summary, which only carries overdue invoices among every other module's
   * stats. */
  async getDashboardSummary(madrasaId: number) {
    try {
      const [totals, statusGroups, overdue, trend] = await Promise.all([
        this.repository.aggregateInvoiceTotals(madrasaId),
        this.repository.groupInvoicesByStatus(madrasaId),
        this.repository.aggregateOverdueInvoices(madrasaId),
        this.repository.findMonthlyCollectionTrend(madrasaId, 12),
      ]);

      const totalInvoiced = Number(totals._sum.amount || 0);
      const totalCollected = Number(totals._sum.paidAmount || 0);
      const totalWaived = Number(totals._sum.waivedAmount || 0);

      const statusBreakdown = {
        unpaid: statusGroups.find((g) => g.status === "UNPAID")?._count._all || 0,
        partiallyPaid: statusGroups.find((g) => g.status === "PARTIALLY_PAID")?._count._all || 0,
        paid: statusGroups.find((g) => g.status === "PAID")?._count._all || 0,
        waived: statusGroups.find((g) => g.status === "WAIVED")?._count._all || 0,
      };

      return {
        totalInvoiced,
        totalCollected,
        totalDue: totalInvoiced - totalCollected - totalWaived,
        totalWaived,
        invoiceCount: totals._count._all,
        statusBreakdown,
        overdue: {
          count: overdue._count._all,
          amount: Number(overdue._sum.amount || 0) - Number(overdue._sum.paidAmount || 0),
        },
        collectionTrend: trend
          .map((row) => ({ period: row.period, total: Number(row.total || 0) }))
          .reverse(),
      };
    } catch (err) {
      return friendlyFailure("getDashboardSummary error:", err, "Failed to load fee dashboard summary");
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
