import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class StudentRepository {
  findMany(where: Prisma.StudentWhereInput) {
    return prisma.student.findMany({
      where,
      select: {
        id: true,
        nameBn: true,
        fatherName: true,
        guardianPhone: true,
        divisionId: true,
        classId: true,
        academicYear: true,
        previousClassId: true,
        gender: true,
        roll: true,
        registrationNo: true,
        classRef: { select: { nameBn: true } },
      },
      orderBy: { id: "desc" },
    });
  }

  findByIdForTenant(id: number, madrasaId: number) {
    return prisma.student.findFirst({
      where: { id, madrasaId },
      include: { classRef: { select: { nameBn: true } } },
    });
  }

  /**
   * Looks up a student by NID within a tenant, regardless of which
   * academic year they were last admitted under. Used to detect
   * returning students at admission time (re-admission / সেশন পরিবর্তন)
   * so a new session doesn't create a duplicate student record.
   */
  findByNid(madrasaId: number, nid: string) {
    return prisma.student.findFirst({
      where: { madrasaId, nid },
      include: { classRef: { select: { nameBn: true } } },
      orderBy: { id: "desc" },
    });
  }

  create(data: Prisma.StudentUncheckedCreateInput) {
    return prisma.student.create({ data });
  }

  /** Highest roll currently assigned within a class for an academic year,
   * used to auto-assign the next roll when the admin doesn't specify one. */
  async getMaxRoll(madrasaId: number, classId: number, academicYear: string): Promise<number> {
    const result = await prisma.student.aggregate({
      where: { madrasaId, classId, academicYear },
      _max: { roll: true },
    });
    return result._max.roll ?? 0;
  }

  /** Highest registration number currently assigned within a madrasa, used
   * to compute the next one for a brand-new admission. */
  async getMaxRegistrationNo(madrasaId: number): Promise<number> {
    const result = await prisma.student.aggregate({
      where: { madrasaId },
      _max: { registrationNo: true },
    });
    return result._max.registrationNo ?? 0;
  }

  updateManyForTenant(id: number, madrasaId: number, data: Record<string, unknown>) {
    return prisma.student.updateMany({
      where: { id, madrasaId },
      data,
    });
  }

  deleteManyForTenant(id: number, madrasaId: number) {
    return prisma.student.deleteMany({
      where: { id, madrasaId },
    });
  }

  /* ---- transaction-scoped helpers used by the bulk-admission flow ---- */

  findByIdForTenantOnTx(tx: TransactionClient, id: number, madrasaId: number) {
    return tx.student.findFirst({ where: { id, madrasaId } });
  }

  findByNidOnTx(tx: TransactionClient, madrasaId: number, nid: string) {
    return tx.student.findFirst({ where: { madrasaId, nid }, orderBy: { id: "desc" } });
  }

  /**
   * PostgreSQL transaction-scoped advisory locks make MAX(roll)+1 safe when
   * two admissions are submitted at the same time. Class IDs are globally
   * unique in this schema, while madrasaId keeps tenant scopes isolated.
   */
  async lockRollScopeOnTx(tx: TransactionClient, madrasaId: number, classId: number) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${madrasaId}::int, ${classId}::int)`;
  }

  /** Serialises permanent registration-number allocation per madrasa. */
  async lockRegistrationScopeOnTx(tx: TransactionClient, madrasaId: number) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${madrasaId}::int, 0::int)`;
  }

  createOnTx(tx: TransactionClient, data: Prisma.StudentUncheckedCreateInput) {
    return tx.student.create({ data });
  }

  async getMaxRegistrationNoOnTx(tx: TransactionClient, madrasaId: number): Promise<number> {
    const result = await tx.student.aggregate({
      where: { madrasaId },
      _max: { registrationNo: true },
    });
    return result._max.registrationNo ?? 0;
  }

  async getMaxRollOnTx(
    tx: TransactionClient,
    madrasaId: number,
    classId: number,
    academicYear: string,
  ): Promise<number> {
    const result = await tx.student.aggregate({
      where: { madrasaId, classId, academicYear },
      _max: { roll: true },
    });
    return result._max.roll ?? 0;
  }

  updateOnTx(tx: TransactionClient, id: number, data: Record<string, unknown>) {
    return tx.student.update({ where: { id }, data });
  }

  updateManyForTenantOnTx(
    tx: TransactionClient,
    id: number,
    madrasaId: number,
    data: Record<string, unknown>,
  ) {
    return tx.student.updateMany({ where: { id, madrasaId }, data });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const studentRepository = new StudentRepository();
