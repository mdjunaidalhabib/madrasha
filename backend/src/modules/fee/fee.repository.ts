import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

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
      },
    });
  }

  findStructureForTenant(id: number, madrasaId: number) {
    return prisma.feeStructure.findFirst({ where: { id, madrasaId } });
  }

  findSessionForTenant(madrasaId: number, id: number) {
    return prisma.session.findFirst({ where: { id, madrasaId } });
  }

  findSessionByNameForTenant(madrasaId: number, name: string) {
    return prisma.session.findUnique({ where: { madrasaId_name: { madrasaId, name } } });
  }

  createStructure(madrasaId: number, data: Record<string, unknown>) {
    return prisma.feeStructure.create({ data: { ...data, madrasaId } as any });
  }

  updateStructure(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.feeStructure.updateMany({ where: { id, madrasaId }, data });
  }

  deleteStructure(id: number, madrasaId: number) {
    return prisma.feeStructure.deleteMany({ where: { id, madrasaId } });
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

  /** Every active fee structure that applies to a student in this class +
   * session (classId null on the structure means "every class"), used to
   * auto-bill a single student right at admission/transfer time. Pass
   * `feeTypes` to bill only specific fee categories (e.g. ["ADMISSION"] at
   * submission time, before a Muhtamim has approved the admission). */
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

  /** Every unpaid/partially-paid ADMISSION-fee invoice across all students,
   * oldest due date first - backs the dedicated "ভর্তি ফি পেন্ডিং" sidebar
   * page (separate from ফি গ্রহণ, which stays purely search-by-student).
   * Deliberately scoped to admission fees only, not every due invoice -
   * routine monthly tuition/exam/boarding dues are handled through normal
   * fee collection, not this "needs office follow-up" list. Only APPROVED
   * students - হিসাব বিভাগ can't collect an admission fee until a Muhtamim
   * has approved that application (PENDING isn't ready yet, REJECTED never
   * becomes a student - see StudentService.approveAdmission/rejectAdmission).
   * Fee collection is decoupled from approval itself (Muhtamim doesn't
   * collect payment, only optionally waives), so this list is what actually
   * gates when হিসাব বিভাগ's queue picks a student up. */
  findPendingInvoices(madrasaId: number, limit: number, offset: number) {
    return prisma.invoice.findMany({
      where: {
        madrasaId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        feeStructure: { feeType: "ADMISSION" },
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
  clearPendingInvoices(madrasaId: number) {
    return prisma.invoice.updateMany({
      where: {
        madrasaId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        feeStructure: { feeType: "ADMISSION" },
        student: { admissionStatus: "APPROVED" },
        queueClearedAt: null,
      },
      data: { queueClearedAt: new Date() },
    });
  }

  /** Hard-deletes every invoice for this tenant (e.g. wiping test/demo
   * invoices before real use) - Payment rows cascade-delete automatically
   * (Payment.invoice has onDelete: Cascade). Irreversible; the service
   * layer gates this behind an explicit typed confirmation. */
  deleteAllInvoices(madrasaId: number) {
    return prisma.invoice.deleteMany({ where: { madrasaId } });
  }

  findInvoiceForTenantOnTx(tx: TransactionClient, id: number, madrasaId: number) {
    return tx.invoice.findFirst({ where: { id, madrasaId } });
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
