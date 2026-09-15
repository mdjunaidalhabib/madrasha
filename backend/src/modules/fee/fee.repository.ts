import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";
import { endOfTodayUTC } from "../../shared/utils/date.util";
import { FEE_CATEGORY_DEFAULTS } from "./fee.constants";

export class FeeRepository {
  /* ================= FEE STRUCTURE ================= */

  findStructures(madrasaId: number, classId?: number, sessionId?: number, academicYear?: string) {
    return prisma.feeStructure.findMany({
      where: {
        madrasaId,
        ...(classId ? { classId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(academicYear ? { academicYear } : {}),
      },
      orderBy: { id: "desc" },
      include: {
        class: { select: { nameBn: true, name: true, division: { select: { nameBn: true } } } },
        sessionRef: { select: { name: true, startDate: true, endDate: true } },
        exam: { select: { id: true, name: true, year: true, sortOrder: true } },
      },
    });
  }

  /** Every non-deleted exam for this tenant, for the "যুক্ত পরীক্ষা" picker on
   * the ফি কাঠামো form - a dedicated fee-module lookup so setting up an
   * exam-linked fee never requires the exam.read permission (see
   * ACCOUNTANT_DEFAULT_PERMISSION_KEYS, which has no exam.* grant).
   *
   * Deliberately NOT filtered to isActive: true - a dormant exam (the
   * default for a freshly-created one, see createDefaultExamsOnTx) still
   * needs to be linkable here, since attaching its পরীক্ষার ফি structure
   * ahead of time is exactly what keeps it dormant until the exam is
   * actually scheduled (see ExamService.activateExamFee). */
  findExamsForTenant(madrasaId: number) {
    return prisma.exam.findMany({
      where: { madrasaId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, year: true },
    });
  }

  findStructureForTenant(id: number, madrasaId: number) {
    return prisma.feeStructure.findFirst({ where: { id, madrasaId } });
  }

  findSessionForTenant(madrasaId: number, id: number) {
    return prisma.session.findFirst({ where: { id, madrasaId } });
  }

  findSessionByNameForTenant(madrasaId: number, name: string, divisionId?: number | null) {
    return prisma.session.findFirst({
      where: { madrasaId, name, ...(divisionId !== undefined ? { divisionId } : {}) },
    });
  }

  createStructure(madrasaId: number, data: Record<string, unknown>) {
    return prisma.feeStructure.create({ data: { ...data, madrasaId } as any });
  }

  updateStructure(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.feeStructure.updateMany({ where: { id, madrasaId }, data });
  }

  /** Cascades a ফি ধরণ (FeeCategory) isActive toggle onto every FeeStructure
   * currently tagged with that category's name (see
   * FeeService.updateCategory) - so turning a category off actually stops
   * it from being billed, not just hides it from the picklist. Matches by
   * feeType text since FeeStructure.feeType is a decoupled plain string. */
  updateStructuresActiveByFeeType(madrasaId: number, feeType: string, isActive: boolean) {
    return prisma.feeStructure.updateMany({ where: { madrasaId, feeType }, data: { isActive } });
  }

  deleteStructure(id: number, madrasaId: number) {
    return prisma.feeStructure.deleteMany({ where: { id, madrasaId } });
  }

  /** Every FeeStructure linked to one specific Exam - drives
   * ExamService.activateExamFee (find what to flip on + which classes/
   * sessions to backfill invoices for). */
  findStructuresByExam(madrasaId: number, examId: number) {
    return prisma.feeStructure.findMany({
      where: { madrasaId, examId },
      select: { id: true, classId: true, sessionId: true, amount: true, name: true },
    });
  }

  /** Flips every FeeStructure linked to this Exam active - see
   * ExamService.activateExamFee. */
  activateStructuresByExam(madrasaId: number, examId: number) {
    return prisma.feeStructure.updateMany({ where: { madrasaId, examId }, data: { isActive: true } });
  }

  /* ================= INVOICES ================= */

  /** Every currently-enrolled student, for the "বিদ্যমান সব ছাত্রের ফি সেট
   * করুন" backfill action - covers students admitted before auto-billing
   * existed, or transferred/promoted into a new session without a fresh
   * admission record. */
  findAllActiveStudents(madrasaId: number, classId?: number, sessionId?: number) {
    return prisma.student.findMany({
      where: {
        madrasaId,
        isActive: 1,
        deletedAt: null,
        admissionStatus: "APPROVED",
        ...(classId ? { classId } : {}),
        ...(sessionId ? { sessionId } : {}),
      },
      select: { id: true, classId: true, sessionId: true, admissionDate: true },
    });
  }

  /** Every currently-enrolled student across every tenant whose session is
   * active on `today` - feeds the daily current-month billing scheduler
   * (see FeeService.generateCurrentMonthInvoices). Deliberately not scoped
   * to one madrasaId, same cross-tenant-query shape as
   * TrashRepository.purgeExpired: the scheduler runs once for the whole
   * platform, not once per tenant. */
  findActiveStudentsForCurrentMonthBilling(today: Date) {
    return prisma.student.findMany({
      where: {
        isActive: 1,
        deletedAt: null,
        admissionStatus: "APPROVED",
        sessionRef: { startDate: { lte: today }, endDate: { gte: today } },
      },
      select: { id: true, madrasaId: true, classId: true, sessionId: true, admissionDate: true },
    });
  }

  /** Every active fee structure that applies to a student in this class +
   * session (classId null on the structure means "every class"), used to
   * auto-bill a single student right at admission/transfer time. Pass
   * `feeTypes` to bill only specific fee categories (e.g. the tenant's
   * admission-flagged category names at submission time, before a Muhtamim
   * has approved the admission - see FeeService.getAdmissionCategoryNames).
   *
   * পরীক্ষার ফি (FeeStructure.examId set) is included like any other fee
   * here - isActive already separates a dormant exam fee (not yet linked
   * to a scheduled exam) from an activated one, so a student admitted
   * after activation is billed for it automatically, same as any other
   * active fee. */
  findActiveStructuresForBilling(
    madrasaId: number,
    classId: number,
    sessionId: number,
    feeTypes?: string[],
  ) {
    return prisma.feeStructure.findMany({
      where: {
        madrasaId,
        sessionId,
        isActive: true,
        OR: [{ classId }, { classId: null }],
        ...(feeTypes && feeTypes.length ? { feeType: { in: feeTypes as any } } : {}),
      },
    });
  }

  /** Guardian phone/name for every currently-enrolled student in one
   * session, optionally narrowed to a set of classes (undefined/empty means
   * every class - a null-classId FeeStructure applies to all of them) - used
   * to notify guardians right when an exam-linked fee is activated (see
   * FeeService.notifyGuardiansOfExamFee). Same active/approved filter as
   * findAllActiveStudents. */
  findGuardianContactsForClasses(madrasaId: number, sessionId: number, classIds?: number[]) {
    return prisma.student.findMany({
      where: {
        madrasaId,
        sessionId,
        isActive: 1,
        deletedAt: null,
        admissionStatus: "APPROVED",
        ...(classIds && classIds.length ? { classId: { in: classIds } } : {}),
      },
      select: { id: true, nameBn: true, guardianPhone: true, classId: true },
    });
  }

  /* ================= ফি ধরণ (FeeCategory) ================= */

  countCategories(madrasaId: number) {
    return prisma.feeCategory.count({ where: { madrasaId } });
  }

  findCategories(madrasaId: number, activeOnly = false) {
    return prisma.feeCategory.findMany({
      where: { madrasaId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findCategoryForTenant(id: number, madrasaId: number) {
    return prisma.feeCategory.findFirst({ where: { id, madrasaId } });
  }

  createCategory(data: Prisma.FeeCategoryUncheckedCreateInput) {
    return prisma.feeCategory.create({ data });
  }

  updateCategory(id: number, data: Prisma.FeeCategoryUpdateInput) {
    return prisma.feeCategory.update({ where: { id }, data });
  }

  deleteCategory(id: number) {
    return prisma.feeCategory.delete({ where: { id } });
  }

  /** Lazily backfills the starter ফি ধরণ picklist for a tenant that has none
   * yet (existing installs from before this feature, and brand-new madrasas
   * alike) - called once from FeeService.getCategories(). Same pattern as
   * AccountRepository.seedDefaultFunds. */
  seedDefaultCategories(madrasaId: number) {
    return prisma.$transaction(
      FEE_CATEGORY_DEFAULTS.map((c, i) =>
        prisma.feeCategory.create({
          data: { madrasaId, name: c.name, isAdmissionType: c.isAdmissionType, sortOrder: i },
        }),
      ),
    );
  }

  /** Active FeeCategory names flagged isAdmissionType for this tenant -
   * replaces the old hardcoded `feeType: "ADMISSION"` filter (see
   * FeeCategory in fee.prisma). Callers should go through
   * FeeService.getAdmissionCategoryNames, which lazily seeds the starter
   * picklist first so this is never empty for a real tenant. */
  async findAdmissionCategoryNames(madrasaId: number) {
    const rows = await prisma.feeCategory.findMany({
      where: { madrasaId, isAdmissionType: true, isActive: true },
      select: { name: true },
    });
    return rows.map((r) => r.name);
  }

  /* ================= STUDENT FEE DISCOUNTS ================= */

  /** Every standing per-fee-structure discount set for one student (see
   * FeeService.previewStudentFees/setStudentFeeDiscount) - merged onto the
   * fee-structure preview shown before admission approval, and re-applied
   * every time a new invoice is generated for that student+structure. */
  findDiscountsForStudent(madrasaId: number, studentId: number) {
    return prisma.studentFeeDiscount.findMany({ where: { madrasaId, studentId } });
  }

  /** Sets (or, when `waivedAmount` is zero, removes) the standing discount
   * for one student+fee-structure pair. Keyed on the uniq_student_fee_discount
   * constraint so re-setting a discount replaces the previous one outright. */
  async upsertStudentFeeDiscount(
    madrasaId: number,
    studentId: number,
    feeStructureId: number,
    waivedAmount: number,
    reason: string,
    setById: number | undefined,
  ) {
    if (waivedAmount <= 0) {
      await prisma.studentFeeDiscount.deleteMany({ where: { madrasaId, studentId, feeStructureId } });
      return null;
    }

    return prisma.studentFeeDiscount.upsert({
      where: { studentId_feeStructureId: { studentId, feeStructureId } },
      create: { madrasaId, studentId, feeStructureId, waivedAmount, reason, setById },
      update: { waivedAmount, reason, setById, setAt: new Date() },
    });
  }

  /** Creates one invoice per student, silently skipping any student who
   * already has an invoice for this fee-structure+month. Checked explicitly
   * rather than relying on the DB's uniq_invoice_student_fee_month
   * constraint, because Postgres treats every NULL as distinct - ONE_TIME/
   * YEARLY fees (e.g. ভর্তি ফি) always store month: null, so that constraint
   * silently lets duplicates through for them (caused real double-billing:
   * admission fee billed once at submission, then again unfiltered at
   * approval). */
  async generateInvoicesOnTx(
    tx: TransactionClient,
    rows: Array<{
      madrasaId: number;
      studentId: number;
      feeStructureId: number;
      title: string;
      amount: Prisma.Decimal | number;
      dueDate: Date;
      month: string | null;
    }>,
  ) {
    let created = 0;
    for (const row of rows) {
      const existing = await tx.invoice.findFirst({
        where: { studentId: row.studentId, feeStructureId: row.feeStructureId, month: row.month },
        select: { id: true },
      });
      if (existing) continue;

      try {
        await tx.invoice.create({ data: row as any });
        created += 1;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          continue; // already billed for this month - skip
        }
        throw err;
      }
    }
    return created;
  }

  /** Every UNPAID/PARTIALLY_PAID invoice due today-or-earlier, across every
   * student - same "overdue" definition as the dashboard's বকেয়া ফি widget
   * (see endOfTodayUTC), for the dedicated "বকেয়া ফী" management page.
   * Unlike findPendingInvoices (admission fees only), this covers every fee
   * type. Grouped per student in FeeService.listOverdueFees. */
  findOverdueInvoices(madrasaId: number, classId?: number, search?: string) {
    const trimmedSearch = search?.trim();
    const numericSearch =
      trimmedSearch && /^\d+$/.test(trimmedSearch) ? Number(trimmedSearch) : undefined;

    return prisma.invoice.findMany({
      where: {
        madrasaId,
        dueDate: { lte: endOfTodayUTC() },
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        student: {
          admissionStatus: { not: "REJECTED" },
          ...(classId ? { classId } : {}),
          ...(trimmedSearch
            ? {
                OR: [
                  { nameBn: { contains: trimmedSearch, mode: "insensitive" } },
                  ...(numericSearch !== undefined
                    ? [{ roll: numericSearch }, { registrationNo: numericSearch }]
                    : []),
                ],
              }
            : {}),
        },
      },
      orderBy: { dueDate: "asc" },
      include: {
        student: {
          select: {
            id: true,
            nameBn: true,
            roll: true,
            registrationNo: true,
            guardianPhone: true,
            classRef: { select: { nameBn: true } },
          },
        },
      },
    });
  }

  findInvoices(madrasaId: number, where: Prisma.InvoiceWhereInput) {
    return prisma.invoice.findMany({
      where: { madrasaId, ...where },
      orderBy: [{ dueDate: "desc" }, { id: "desc" }],
      include: {
        student: { select: { nameBn: true, roll: true } },
        payments: true,
      },
    });
  }

  /** Every unpaid/partially-paid admission-fee invoice across all students,
   * oldest due date first - backs the dedicated "ভর্তি ফি পেন্ডিং" sidebar
   * page (separate from ফি গ্রহণ, which stays purely search-by-student).
   * Deliberately scoped to admission fees only (`admissionFeeTypes` - see
   * FeeService.getAdmissionCategoryNames), not every due invoice - routine
   * monthly tuition/exam/boarding dues are handled through normal fee
   * collection, not this "needs office follow-up" list. Only APPROVED
   * students - হিসাব বিভাগ can't collect an admission fee until a Muhtamim
   * has approved that application (PENDING isn't ready yet, REJECTED never
   * becomes a student - see StudentService.approveAdmission/rejectAdmission).
   * Fee collection is decoupled from approval itself (Muhtamim doesn't
   * collect payment, only optionally waives), so this list is what actually
   * gates when হিসাব বিভাগ's queue picks a student up. */
  findPendingInvoices(madrasaId: number, limit: number, offset: number, admissionFeeTypes: string[]) {
    return prisma.invoice.findMany({
      where: {
        madrasaId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        feeStructure: { feeType: { in: admissionFeeTypes } },
        student: { admissionStatus: "APPROVED" },
        queueClearedAt: null,
      },
      // Newest admission first - this is a "needs office follow-up" queue,
      // not a due-date worklist, so a just-approved student should surface
      // immediately instead of waiting behind older due dates.
      orderBy: [{ id: "desc" }],
      include: {
        student: { select: { nameBn: true, roll: true, registrationNo: true, classRef: { select: { nameBn: true } } } },
      },
      take: limit,
      skip: offset,
    });
  }

  /** "সব ক্লিয়ার করুন" - hides every invoice currently on the pending queue
   * from that queue only (queueClearedAt), for every office user. The
   * invoice itself is untouched and stays fully payable from ছাত্র ফি গ্রহণ. */
  clearPendingInvoices(madrasaId: number, admissionFeeTypes: string[]) {
    return prisma.invoice.updateMany({
      where: {
        madrasaId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        feeStructure: { feeType: { in: admissionFeeTypes } },
        student: { admissionStatus: "APPROVED" },
        queueClearedAt: null,
      },
      data: { queueClearedAt: new Date() },
    });
  }

  findInvoiceForTenantOnTx(tx: TransactionClient, id: number, madrasaId: number) {
    return tx.invoice.findFirst({ where: { id, madrasaId } });
  }

  /** Whether an invoice's fee structure is linked to an exam - drives the
   * fee-linked exam-candidate auto-registration trigger in fee.service.ts's
   * recordPayment(). Returns null when the fee structure has no exam link
   * (or doesn't exist/belong to this tenant), in which case the caller
   * skips the hook entirely. */
  findFeeStructureExamLink(madrasaId: number, feeStructureId: number) {
    return prisma.feeStructure.findFirst({ where: { id: feeStructureId, madrasaId }, select: { examId: true } });
  }

  updateInvoiceOnTx(tx: TransactionClient, id: number, data: Record<string, unknown>) {
    return tx.invoice.update({ where: { id }, data });
  }

  createPaymentOnTx(tx: TransactionClient, data: Record<string, unknown>) {
    return tx.payment.create({ data: data as any });
  }

  /** Statement data for one student: every invoice + every payment,
   * newest first, used by the Student Account Statement feature. */
  findStatementForStudent(madrasaId: number, studentId: number) {
    return prisma.invoice.findMany({
      where: { madrasaId, studentId },
      orderBy: { dueDate: "desc" },
      include: { payments: { orderBy: { paidAt: "desc" } } },
    });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }

  /* ================= DASHBOARD SUMMARY ================= */

  aggregateInvoiceTotals(madrasaId: number) {
    return prisma.invoice.aggregate({
      where: { madrasaId },
      _sum: { amount: true, paidAmount: true, waivedAmount: true },
      _count: { _all: true },
    });
  }

  groupInvoicesByStatus(madrasaId: number) {
    return prisma.invoice.groupBy({
      by: ["status"],
      where: { madrasaId },
      _count: { _all: true },
    });
  }

  aggregateOverdueInvoices(madrasaId: number) {
    return prisma.invoice.aggregate({
      where: { madrasaId, status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } },
      _sum: { amount: true, paidAmount: true },
      _count: { _all: true },
    });
  }

  /** Monthly collected-payment totals for the last `limit` months with at
   * least one payment, newest first - feeds the ফি ব্যবস্থাপনা dashboard's
   * collection trend chart. Raw SQL since GROUP BY on a formatted date has
   * no clean Prisma equivalent (same reasoning as
   * dashboard.repository.ts's period-based queries). */
  findMonthlyCollectionTrend(madrasaId: number, limit: number) {
    return prisma.$queryRaw<{ period: string; total: Prisma.Decimal | number }[]>`
      SELECT to_char(paid_at, 'YYYY-MM') AS period, SUM(amount) AS total
      FROM payments
      WHERE madrasa_id = ${madrasaId}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${limit}
    `;
  }

  /* ================= MANUAL PAYMENT METHOD SETUP ================= */

  findPaymentMethodSettings(madrasaId: number, activeOnly = false) {
    return prisma.paymentMethodSetting.findMany({
      where: { madrasaId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { id: "asc" },
    });
  }

  findPaymentMethodSettingForTenant(id: number, madrasaId: number) {
    return prisma.paymentMethodSetting.findFirst({ where: { id, madrasaId } });
  }

  createPaymentMethodSetting(madrasaId: number, data: Record<string, unknown>) {
    return prisma.paymentMethodSetting.create({ data: { ...data, madrasaId } as any });
  }

  updatePaymentMethodSetting(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.paymentMethodSetting.updateMany({ where: { id, madrasaId }, data });
  }

  deletePaymentMethodSetting(id: number, madrasaId: number) {
    return prisma.paymentMethodSetting.deleteMany({ where: { id, madrasaId } });
  }
}

export const feeRepository = new FeeRepository();
