import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

/** Smallest positive integer missing from a sorted (ascending) list of used
 * roll numbers - i.e. the first reusable gap, or one past the current max
 * if there's no gap. `rolls` is expected sorted by the caller's query. */
const firstAvailableRoll = (rolls: (number | null)[]): number => {
  let expected = 1;
  for (const roll of rolls) {
    if (roll == null || roll < expected) continue; // stale/duplicate data - ignore
    if (roll > expected) break; // gap found at `expected`
    expected++;
  }
  return expected;
};

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

  findSessionForTenant(madrasaId: number, id: number) {
    return prisma.session.findFirst({ where: { id, madrasaId } });
  }

  /** divisionId given -> that division's own session by name, falling back to the legacy
   *  shared (divisionId: null) session of the same name if the division has none of its
   *  own yet (mirrors SessionRepository.findCurrentSession's fallback). */
  async findSessionByNameForTenant(madrasaId: number, name: string, divisionId?: number | null) {
    const session = await prisma.session.findFirst({
      where: { madrasaId, name, ...(divisionId !== undefined ? { divisionId } : {}) },
    });
    if (session || divisionId == null) return session;
    return prisma.session.findFirst({ where: { madrasaId, name, divisionId: null } });
  }

  create(data: Prisma.StudentUncheckedCreateInput) {
    return prisma.student.create({ data });
  }

  /** Highest roll currently assigned within a class for an academic year,
   * used to auto-assign the next roll when the admin doesn't specify one.
   * @deprecated for "assign a brand-new roll" call sites - prefer
   * getNextAvailableRoll, which reclaims a permanently-deleted student's
   * number instead of leaving it as a permanent gap. Kept only for the
   * (unrelated) bulk-admission batch counter, which intentionally hands out
   * a clean run of consecutive numbers to a freshly-imported class list. */
  async getMaxRoll(madrasaId: number, classId: number, academicYear: string): Promise<number> {
    const result = await prisma.student.aggregate({
      where: { madrasaId, classId, academicYear, deletedAt: null },
      _max: { roll: true },
    });
    return result._max.roll ?? 0;
  }

  /** Smallest positive roll number not currently held by ANY row - active
   * OR trashed - in this class/year. A student in Trash still "holds" its
   * roll (so restoring it later can never clash with someone else who took
   * "its" number - see the doc-comment on the unique_roll_per_class_session
   * constraint), so trashed rows are deliberately NOT excluded here. Only a
   * genuinely gone row (permanently deleted from Trash, or never existed)
   * counts as free. This is what lets a permanent-delete actually free up
   * its roll for reuse instead of every deletion leaving a permanent gap.
   * PENDING/REJECTED applicants hold no roll at all (roll is null - see the
   * field's doc-comment and StudentService.approveAdmission), so filtering
   * those out here is what lets a rejected/cancelled application's number
   * become available again immediately. */
  async getNextAvailableRoll(madrasaId: number, classId: number, academicYear: string): Promise<number> {
    const rows = await prisma.student.findMany({
      where: { madrasaId, classId, academicYear, roll: { not: null } },
      select: { roll: true },
      orderBy: { roll: "asc" },
    });
    return firstAvailableRoll(rows.map((row) => row.roll));
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

  countPendingAdmissions(madrasaId: number) {
    return prisma.student.count({ where: { madrasaId, admissionStatus: "PENDING", deletedAt: null } });
  }

  /** Rejected admissions - kept as a record (rejectionReason/reviewedBy/
   * reviewedAt) rather than deleted at reject time, but with no page of
   * their own until now (see getRejectedAdmissions). */
  findRejectedForTenant(madrasaId: number) {
    return prisma.student.findMany({
      where: { madrasaId, admissionStatus: "REJECTED", deletedAt: null },
      include: { classRef: { select: { nameBn: true } } },
      orderBy: { reviewedAt: "desc" },
    });
  }

  /** Hard delete (not the usual soft-delete-to-Trash) - a rejected
   * application never was a real enrolled student. Scoped to
   * admissionStatus=REJECTED so this can never accidentally remove an
   * approved/pending student even if a stale id is passed. */
  permanentDeleteRejectedApplication(id: number, madrasaId: number) {
    return prisma.student.deleteMany({
      where: { id, madrasaId, admissionStatus: "REJECTED", deletedAt: null },
    });
  }

  /* ================= DASHBOARD SUMMARY ================= */

  countApprovedActive(madrasaId: number) {
    return prisma.student.count({
      where: { madrasaId, isActive: 1, deletedAt: null, admissionStatus: "APPROVED" },
    });
  }

  groupByGender(madrasaId: number) {
    return prisma.student.groupBy({
      by: ["gender"],
      where: { madrasaId, isActive: 1, deletedAt: null, admissionStatus: "APPROVED" },
      _count: { _all: true },
    });
  }

  groupByClass(madrasaId: number) {
    return prisma.student.groupBy({
      by: ["classId"],
      where: { madrasaId, isActive: 1, deletedAt: null, admissionStatus: "APPROVED" },
      _count: { _all: true },
    });
  }

  findClassNames(classIds: number[]) {
    return prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, nameBn: true } });
  }

  groupByAdmissionStatus(madrasaId: number) {
    return prisma.student.groupBy({
      by: ["admissionStatus"],
      where: { madrasaId, deletedAt: null },
      _count: { _all: true },
    });
  }

  /** Monthly admission counts for the last `limit` months with at least one
   * admission, newest first - feeds the শিক্ষার্থী dashboard's admission trend
   * chart. Raw SQL since GROUP BY on a formatted date has no clean Prisma
   * equivalent (same reasoning as dashboard.repository.ts's period-based
   * queries). */
  findAdmissionTrend(madrasaId: number, limit: number) {
    return prisma.$queryRaw<{ period: string; count: bigint }[]>`
      SELECT to_char(admission_date, 'YYYY-MM') AS period, COUNT(*) AS count
      FROM students
      WHERE madrasa_id = ${madrasaId} AND deleted_at IS NULL AND admission_date IS NOT NULL
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${limit}
    `;
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

  findSessionForTenantOnTx(tx: TransactionClient, madrasaId: number, id: number) {
    return tx.session.findFirst({ where: { id, madrasaId } });
  }

  /** See findSessionByNameForTenant - same divisionId -> null fallback, on a tx client. */
  async findSessionByNameForTenantOnTx(
    tx: TransactionClient,
    madrasaId: number,
    name: string,
    divisionId?: number | null,
  ) {
    const session = await tx.session.findFirst({
      where: { madrasaId, name, ...(divisionId !== undefined ? { divisionId } : {}) },
    });
    if (session || divisionId == null) return session;
    return tx.session.findFirst({ where: { madrasaId, name, divisionId: null } });
  }

  createSessionHistoryOnTx(tx: TransactionClient, data: Record<string, unknown>) {
    return tx.studentSessionHistory.create({ data: data as any });
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

  /** @deprecated for "assign a brand-new roll" call sites - see getMaxRoll's
   * doc-comment; use getNextAvailableRollOnTx instead. */
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

  /** Transaction-scoped twin of getNextAvailableRoll - see that method's
   * doc-comment. Always call after lockRollScopeOnTx so concurrent requests
   * for the same class/year can't both land on the same gap. */
  async getNextAvailableRollOnTx(
    tx: TransactionClient,
    madrasaId: number,
    classId: number,
    academicYear: string,
  ): Promise<number> {
    const rows = await tx.student.findMany({
      where: { madrasaId, classId, academicYear, roll: { not: null } },
      select: { roll: true },
      orderBy: { roll: "asc" },
    });
    return firstAvailableRoll(rows.map((row) => row.roll));
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
