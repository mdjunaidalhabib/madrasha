import { Prisma, ExamCandidateStatus, EligibilityStatus } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

const candidateListInclude = {
  student: {
    select: {
      id: true,
      nameBn: true,
      nameEn: true,
      roll: true,
      registrationNo: true,
      guardianPhone: true,
      isActive: true,
      admissionStatus: true,
    },
  },
  class: { select: { id: true, name: true, nameBn: true } },
  division: { select: { id: true, name: true, nameBn: true } },
} satisfies Prisma.ExamCandidateInclude;

export class ExamCandidateRepository {
  findExam(madrasaId: number, examId: number) {
    return prisma.exam.findFirst({ where: { id: examId, madrasaId, deletedAt: null } });
  }

  /** Fields the eligibility engine needs off Student, scoped to the tenant. */
  findStudentForEligibility(madrasaId: number, studentId: number) {
    return prisma.student.findFirst({
      where: { id: studentId, madrasaId, deletedAt: null },
      select: {
        id: true,
        madrasaId: true,
        classId: true,
        divisionId: true,
        sessionId: true,
        isActive: true,
        admissionStatus: true,
        nameBn: true,
        roll: true,
      },
    });
  }

  async listCandidates(
    madrasaId: number,
    filters: {
      examId: number;
      classId?: number;
      divisionId?: number;
      status?: ExamCandidateStatus;
      eligibilityStatus?: EligibilityStatus;
      search?: string;
    },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.ExamCandidateWhereInput = {
      madrasaId,
      examId: filters.examId,
      ...(filters.classId ? { classId: filters.classId } : {}),
      ...(filters.divisionId ? { divisionId: filters.divisionId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.eligibilityStatus ? { eligibilityStatus: filters.eligibilityStatus } : {}),
      ...(filters.search
        ? {
            student: {
              OR: [
                { nameBn: { contains: filters.search, mode: "insensitive" } },
                { nameEn: { contains: filters.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.examCandidate.findMany({
        where,
        include: candidateListInclude,
        orderBy: [{ id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.examCandidate.count({ where }),
    ]);

    return { rows, total };
  }

  findCandidateById(madrasaId: number, id: number) {
    return prisma.examCandidate.findFirst({
      where: { id, madrasaId },
      include: candidateListInclude,
    });
  }

  findCandidateByIds(madrasaId: number, ids: number[]) {
    return prisma.examCandidate.findMany({
      where: { id: { in: ids }, madrasaId },
      include: candidateListInclude,
    });
  }

  findCandidateByExamStudent(madrasaId: number, examId: number, studentId: number) {
    return prisma.examCandidate.findFirst({ where: { madrasaId, examId, studentId } });
  }

  findCandidatesByExam(madrasaId: number, examId: number, candidateIds?: number[]) {
    return prisma.examCandidate.findMany({
      where: { madrasaId, examId, ...(candidateIds ? { id: { in: candidateIds } } : {}) },
    });
  }

  /** Active, admitted students in a class/division not yet registered for
   * this exam - the pool shown on the "register students" screen. */
  findEligibleStudentPool(
    madrasaId: number,
    filters: { examId: number; classId?: number; divisionId?: number; search?: string },
  ) {
    return prisma.student.findMany({
      where: {
        madrasaId,
        deletedAt: null,
        isActive: 1,
        admissionStatus: "APPROVED",
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.divisionId ? { divisionId: filters.divisionId } : {}),
        ...(filters.search
          ? {
              OR: [
                { nameBn: { contains: filters.search, mode: "insensitive" } },
                { nameEn: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
        examCandidates: { none: { examId: filters.examId } },
      },
      select: {
        id: true,
        nameBn: true,
        nameEn: true,
        roll: true,
        classId: true,
        divisionId: true,
        sessionId: true,
        isActive: true,
        admissionStatus: true,
      },
      orderBy: [{ roll: "asc" }],
    });
  }

  /** Sequential exam-scoped registration number, e.g. "REG-3-0007". Reads
   * the current max suffix for this exam and increments - safe to call
   * inside the same transaction as the create for bulk registration. */
  async nextRegistrationNo(tx: TransactionClient, madrasaId: number, examId: number): Promise<string> {
    const count = await tx.examCandidate.count({ where: { madrasaId, examId } });
    return `REG-${examId}-${String(count + 1).padStart(4, "0")}`;
  }

  /** Same numbering scheme as `nextRegistrationNo`, but reserves `count`
   * sequential numbers in one go (one count query instead of one per
   * candidate) - for batch auto-registration via `registerBatch`. */
  async nextRegistrationNoBatch(
    tx: TransactionClient,
    madrasaId: number,
    examId: number,
    count: number,
  ): Promise<string[]> {
    const current = await tx.examCandidate.count({ where: { madrasaId, examId } });
    return Array.from({ length: count }, (_, i) => `REG-${examId}-${String(current + i + 1).padStart(4, "0")}`);
  }

  createCandidateOnTx(
    tx: TransactionClient,
    data: {
      madrasaId: number;
      examId: number;
      studentId: number;
      sessionId: number;
      classId: number;
      divisionId: number;
      registrationNo: string;
      notes?: string | null;
      createdBy?: number | null;
    },
  ) {
    return tx.examCandidate.create({ data });
  }

  /** Bulk-inserts candidate rows for automatic registration (routine-driven
   * free exams, or a single invoice-paid trigger). `skipDuplicates` relies
   * on the `uniq_exam_candidate_exam_student` unique constraint on
   * [examId, studentId] so a race with another trigger can never create a
   * second row for the same student+exam. */
  createCandidatesOnTx(
    tx: TransactionClient,
    rows: Array<{
      madrasaId: number;
      examId: number;
      studentId: number;
      sessionId: number;
      classId: number;
      divisionId: number;
      registrationNo: string;
      createdBy?: number | null;
    }>,
  ): Promise<{ count: number }> {
    return tx.examCandidate.createMany({ data: rows, skipDuplicates: true });
  }

  /** Whether this exam has an active, linked fee structure - a fee-linked
   * exam's candidates are only ever auto-registered on full payment
   * (see `autoRegisterOnInvoicePaid`), never from routine creation. */
  async examHasFeeLink(madrasaId: number, examId: number): Promise<boolean> {
    const count = await prisma.feeStructure.count({ where: { madrasaId, examId, isActive: true } });
    return count > 0;
  }

  /** FeeStructure ids linked to this exam - used by eligibility.service.ts
   * to scope a dues check to just this exam's own fee(s) instead of the
   * whole account, when scopeDuesToExamFee is on. */
  async findFeeStructureIdsForExam(madrasaId: number, examId: number): Promise<number[]> {
    const rows = await prisma.feeStructure.findMany({
      where: { madrasaId, examId, isActive: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Flips a CANCELLED registration back to REGISTERED instead of creating
   * a second row - keeps the [examId, studentId] uniqueness meaningful as
   * "duplicate registration protection" rather than blocking re-registration
   * after a withdrawal. */
  reactivateCandidateOnTx(
    tx: TransactionClient,
    id: number,
    data: { notes?: string | null; updatedBy?: number | null },
  ) {
    return tx.examCandidate.update({
      where: { id },
      data: {
        status: ExamCandidateStatus.REGISTERED,
        eligibilityStatus: EligibilityStatus.PENDING,
        eligibilityReasons: null,
        eligibilityCheckedAt: null,
        notes: data.notes,
        updatedBy: data.updatedBy,
      },
    });
  }

  updateEligibility(
    id: number,
    data: { eligibilityStatus: EligibilityStatus; eligibilityReasons: string; status?: ExamCandidateStatus },
  ) {
    return prisma.examCandidate.update({
      where: { id },
      data: {
        eligibilityStatus: data.eligibilityStatus,
        eligibilityReasons: data.eligibilityReasons,
        eligibilityCheckedAt: new Date(),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  updateStatus(madrasaId: number, id: number, status: ExamCandidateStatus, notes: string | undefined, updatedBy?: number) {
    return prisma.examCandidate.updateMany({
      where: { id, madrasaId },
      data: { status, ...(notes !== undefined ? { notes } : {}), updatedBy },
    });
  }

  bulkUpdateStatus(madrasaId: number, ids: number[], status: ExamCandidateStatus, updatedBy?: number) {
    return prisma.examCandidate.updateMany({
      where: { id: { in: ids }, madrasaId },
      data: { status, updatedBy },
    });
  }

  /* ================= ELIGIBILITY SETTINGS (reuses Setting model) ================= */

  async findSettings(madrasaId: number, keys: string[]) {
    const rows = await prisma.setting.findMany({
      where: { madrasaId, name: { in: keys } },
      select: { name: true, value: true },
    });
    return new Map(rows.map((row) => [row.name, row.value]));
  }

  upsertSetting(madrasaId: number, name: string, value: string) {
    return prisma.setting.upsert({
      where: { madrasaId_name: { madrasaId, name } },
      update: { value },
      create: { madrasaId, name, value },
    });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const examCandidateRepository = new ExamCandidateRepository();
