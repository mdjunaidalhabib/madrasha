import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

export class StudentRepository {
  findMany(where: Prisma.StudentWhereInput) {
    return prisma.student.findMany({
      where: { ...where, deletedAt: null },
      include: { classRef: { select: { nameBn: true } } },
      orderBy: [{ registrationNo: "asc" }, { id: "asc" }],
    });
  }

  findByIdForTenant(id: number, madrasaId: number) {
    return prisma.student.findFirst({
      where: { id, madrasaId, deletedAt: null },
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
      where: { madrasaId, nid, deletedAt: null },
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
      where: { madrasaId, classId, academicYear, deletedAt: null },
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

  /** Admissions still awaiting admin review (see Admission Approval Workflow). */
  findPendingForTenant(madrasaId: number) {
    return prisma.student.findMany({
      where: { madrasaId, admissionStatus: "PENDING", deletedAt: null },
      include: { classRef: { select: { nameBn: true } } },
      orderBy: { id: "desc" },
    });
  }

  // Soft delete — moves the student to Trash instead of hard-deleting.
  deleteManyForTenant(id: number, madrasaId: number) {
    return prisma.student.updateMany({
      where: { id, madrasaId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // Bulk soft delete — moves many students to Trash at once (Student List bulk action).
  softDeleteManyByIds(madrasaId: number, ids: number[]) {
    return prisma.student.updateMany({
      where: { madrasaId, id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /** Flips the Expel status (`isActive`) without moving the record to Trash. */
  setActiveStatus(id: number, madrasaId: number, isActive: number) {
    return prisma.student.updateMany({
      where: { id, madrasaId, deletedAt: null },
      data: { isActive },
    });
  }

  /* ---- transaction-scoped helpers used by the bulk-admission flow ---- */

  findByIdForTenantOnTx(tx: TransactionClient, id: number, madrasaId: number) {
    return tx.student.findFirst({ where: { id, madrasaId, deletedAt: null } });
  }

  /** Batched lookup for bulk-update: one query instead of N. */
  findManyByIdsForTenantOnTx(tx: TransactionClient, ids: number[], madrasaId: number) {
    return tx.student.findMany({ where: { id: { in: ids }, madrasaId, deletedAt: null } });
  }

  /** Valid class ids for a tenant (Class is a global catalog, activated per
   * tenant via MadrasaClass), used to pre-validate previous_class_id before
   * it reaches an update() call - a bad FK value would otherwise poison the
   * rest of the surrounding $transaction on Postgres. */
  async findClassIdsForTenantOnTx(tx: TransactionClient, madrasaId: number): Promise<Set<number>> {
    const rows = await tx.madrasaClass.findMany({ where: { madrasaId }, select: { classId: true } });
    return new Set(rows.map((r) => r.classId));
  }

  findByNidOnTx(tx: TransactionClient, madrasaId: number, nid: string) {
    return tx.student.findFirst({
      where: { madrasaId, nid, deletedAt: null },
      orderBy: { id: "desc" },
    });
  }

  /**
   * Acquires a transaction-scoped, namespaced PostgreSQL advisory lock.
   * Text keys keep identity, record, roll and registration locks in separate
   * domains and avoid accidental collisions with numeric IDs.
   */
  private async lockKeyOnTx(tx: TransactionClient, key: string) {
    // pg_advisory_xact_lock() returns `void`. $queryRaw tries to deserialize
    // the returned column and fails on the unsupported `void` type ("Failed
    // to deserialize column of type 'void'"). We only need the side effect
    // (acquiring the lock), not a result row, so $executeRaw must be used
    // here instead of $queryRaw.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  /** Prevents two concurrent admission requests for the same NID from both
   * creating or re-admitting the same student independently. */
  lockStudentIdentityOnTx(tx: TransactionClient, madrasaId: number, nid: string) {
    return this.lockKeyOnTx(tx, `student-identity:${madrasaId}:${nid}`);
  }

  /** Serialises changes to one student record across admission and profile
   * update flows. */
  lockStudentRecordOnTx(tx: TransactionClient, madrasaId: number, studentId: number) {
    return this.lockKeyOnTx(tx, `student-record:${madrasaId}:${studentId}`);
  }

  /** Makes MAX(roll)+1 safe within one madrasa + class + academic year. */
  lockRollScopeOnTx(
    tx: TransactionClient,
    madrasaId: number,
    classId: number,
    academicYear: string,
  ) {
    return this.lockKeyOnTx(tx, `student-roll:${madrasaId}:${classId}:${academicYear}`);
  }

  /** Serialises permanent registration-number allocation per madrasa. */
  lockRegistrationScopeOnTx(tx: TransactionClient, madrasaId: number) {
    return this.lockKeyOnTx(tx, `student-registration:${madrasaId}`);
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
      where: { madrasaId, classId, academicYear, deletedAt: null },
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
