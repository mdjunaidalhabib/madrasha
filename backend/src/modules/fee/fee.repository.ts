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

  findStudentsForBilling(madrasaId: number, classId: number, sessionId: number) {
    return prisma.student.findMany({
      where: { madrasaId, classId, sessionId, isActive: 1, deletedAt: null },
      select: { id: true },
    });
  }

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
   * already has an invoice for this fee-structure+month (unique constraint
   * makes re-running this safe). */
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
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      include: {
        student: { select: { nameBn: true, roll: true, registrationNo: true, classRef: { select: { nameBn: true } } } },
      },
      take: limit,
      skip: offset,
    });
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
