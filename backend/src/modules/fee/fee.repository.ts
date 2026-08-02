import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class FeeRepository {
  /* ================= FEE STRUCTURE ================= */

  findStructures(madrasaId: number, classId?: number, academicYear?: string) {
    return prisma.feeStructure.findMany({
      where: {
        madrasaId,
        ...(classId ? { classId } : {}),
        ...(academicYear ? { academicYear } : {}),
      },
      orderBy: { id: "desc" },
      include: { class: { select: { nameBn: true, name: true } } },
    });
  }

  findStructureForTenant(id: number, madrasaId: number) {
    return prisma.feeStructure.findFirst({ where: { id, madrasaId } });
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

  findStudentsForBilling(madrasaId: number, classId: number, academicYear: string) {
    return prisma.student.findMany({
      where: { madrasaId, classId, academicYear, isActive: 1, deletedAt: null },
      select: { id: true },
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
