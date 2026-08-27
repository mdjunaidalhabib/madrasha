import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class PayrollRepository {
  findActiveTeachers(madrasaId: number) {
    return prisma.teacher.findMany({
      where: { madrasaId, isActive: 1, deletedAt: null },
      select: { id: true, nameBn: true, salary: true },
    });
  }

  async generateOnTx(
    tx: TransactionClient,
    rows: Array<{
      madrasaId: number;
      teacherId: number;
      month: string;
      basicSalary: Prisma.Decimal | number;
      allowances: Prisma.Decimal | number;
      deductions: Prisma.Decimal | number;
      netAmount: Prisma.Decimal | number;
    }>,
  ) {
    let created = 0;
    for (const row of rows) {
      try {
        await tx.payrollRecord.create({ data: row as any });
        created += 1;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          continue; // already generated for this teacher+month
        }
        throw err;
      }
    }
    return created;
  }

  findMany(madrasaId: number, where: Prisma.PayrollRecordWhereInput) {
    return prisma.payrollRecord.findMany({
      where: { madrasaId, ...where },
      orderBy: [{ month: "desc" }, { id: "desc" }],
      include: { teacher: { select: { nameBn: true, designation: true } } },
    });
  }

  findForTenantOnTx(tx: TransactionClient, id: number, madrasaId: number) {
    return tx.payrollRecord.findFirst({
      where: { id, madrasaId },
      include: { teacher: { select: { nameBn: true, phone: true } } },
    });
  }

  markPaidOnTx(
    tx: TransactionClient,
    id: number,
    data: { paidAt: Date; paidById: number | null; accountEntryId: number },
  ) {
    return tx.payrollRecord.update({ where: { id }, data: { status: "PAID", ...data } });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const payrollRepository = new PayrollRepository();
