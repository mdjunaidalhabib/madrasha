import { prisma } from "../../shared/database/prisma";
import { GUARDIAN_NOTICES_LIMIT } from "./guardian.constants";
import { tenantClassNameSelect, tenantDivisionNameSelect } from "../../shared/utils/tenant-name.util";
import { activityContext } from "../../shared/utils/activityContext";
import { NotFoundError } from "../../shared/errors";
import { t } from "../../shared/i18n";

export class GuardianRepository {
  findPersonalProfile(madrasaId: number, studentId: number) {
    return prisma.student.findFirst({
      where: { id: studentId, madrasaId, deletedAt: null },
      select: {
        id: true, nameBn: true, nameEn: true, arabicName: true, image: true,
        roll: true, registrationNo: true, dob: true, age: true, gender: true,
        nid: true, bloodGroup: true, residencyType: true, isOrphan: true,
        fatherName: true, fatherNameEn: true, fatherArabicName: true,
        fatherNid: true, fatherOccupation: true,
        motherName: true, motherNameEn: true, motherArabicName: true,
        motherNid: true, motherOccupation: true,
        guardianPhone: true, guardianPhone2: true,
        altGuardianName: true, altGuardianNameEn: true, altGuardianArabicName: true,
        altGuardianRelation: true, altGuardianAddress: true, altGuardianPhone: true,
        division: true, district: true, thana: true, village: true,
        academicYear: true, admissionDate: true, admissionStatus: true,
        admissionType: true, isActive: true,
        previousInstitution: true, previousResult: true,
        classRef: { select: tenantClassNameSelect(madrasaId) },
        divisionRef: { select: tenantDivisionNameSelect(madrasaId) },
        previousClass: { select: tenantClassNameSelect(madrasaId) },
        sessionRef: { select: { name: true } },
      },
    });
  }

  async findForStudent(madrasaId: number, studentId: number) {
    const student = await prisma.student.findFirst({
      where: { id: studentId, madrasaId, deletedAt: null },
      select: { guardianPhone: true },
    });
    if (!student?.guardianPhone) return null;
    return prisma.guardian.findFirst({
      where: { madrasaId, phone: student.guardianPhone, isActive: 1,
        students: { some: { studentId } } },
    });
  }

  async resetPassword(guardianId: number, madrasaId: number, passwordHash: string, actorId: number, studentId: number) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.guardian.updateMany({
        where: { id: guardianId, madrasaId, isActive: 1 },
        data: { passwordHash, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null },
      });
      if (!updated.count) throw new NotFoundError(t({ bn: "অভিভাবক অ্যাকাউন্ট পাওয়া যায়নি।", en: "Guardian account not found." }));
      await tx.activityLog.create({ data: {
        madrasaId, userId: actorId, action: "UPDATE", entity: "students/guardian/reset-password",
        entityId: studentId, details: JSON.stringify({ guardianId, cardVerified: true, resetConfirmed: true }),
      } });
    });
    activityContext.getStore()?.logged.push({ madrasaId, userId: actorId, entity: "students/guardian/reset-password" });
  }

  findActiveByPhone(madrasaId: number, phone: string) {
    return prisma.guardian.findFirst({ where: {
      madrasaId, phone, isActive: 1,
      students: { some: { student: { madrasaId, deletedAt: null, guardianPhone: phone } } },
    } });
  }

  async findByIdForTenant(id: number, madrasaId: number) {
    const guardian = await prisma.guardian.findFirst({ where: { id, madrasaId, isActive: 1 } });
    if (!guardian) return null;
    const child = await prisma.guardianStudent.findFirst({
      where: { guardianId: id, student: { madrasaId, deletedAt: null, guardianPhone: guardian.phone } },
      select: { id: true },
    });
    return child ? guardian : null;
  }

  /** Finds the existing guardian for (madrasaId, phone), or creates a new
   * one with the given default password hash. Returns the row plus whether
   * it was newly created, so the caller only treats a freshly generated
   * password as "the" credential when a new account was actually made. */
  async upsertGuardian(params: {
    madrasaId: number;
    phone: string;
    name: string | null;
    passwordHash: string;
  }) {
    // Reuse an existing account even when its last student was removed.
    // Login eligibility is checked separately from account provisioning.
    const existing = await prisma.guardian.findFirst({
      where: { madrasaId: params.madrasaId, phone: params.phone, isActive: 1 },
    });
    if (existing) return { guardian: existing, created: false };

    const created = await prisma.guardian.create({
      data: {
        madrasaId: params.madrasaId,
        phone: params.phone,
        name: params.name,
        passwordHash: params.passwordHash,
        mustChangePassword: true,
      },
    });
    return { guardian: created, created: true };
  }

  linkStudentIfMissing(guardianId: number, studentId: number) {
    return prisma.guardianStudent.upsert({
      where: { guardianId_studentId: { guardianId, studentId } },
      update: {},
      create: { guardianId, studentId },
    });
  }

  recordFailedLogin(guardianId: number, attempts: number, lockedUntil: Date | null) {
    return prisma.guardian.update({
      where: { id: guardianId },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });
  }

  recordSuccessfulLogin(guardianId: number) {
    return prisma.guardian.update({
      where: { id: guardianId },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  updatePassword(guardianId: number, passwordHash: string) {
    return prisma.guardian.update({
      where: { id: guardianId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  async findOwnership(guardianId: number, studentId: number) {
    const link = await prisma.guardianStudent.findUnique({
      where: { guardianId_studentId: { guardianId, studentId } },
      include: { guardian: true, student: true },
    });
    if (!link || link.guardian.isActive !== 1 || link.student.deletedAt ||
      link.student.madrasaId !== link.guardian.madrasaId ||
      link.student.guardianPhone !== link.guardian.phone) return null;
    return link;
  }

  async findChildrenForGuardian(guardianId: number, madrasaId: number) {
    const guardian = await this.findByIdForTenant(guardianId, madrasaId);
    if (!guardian) return [];
    return prisma.guardianStudent.findMany({
      where: { guardianId, student: { madrasaId, deletedAt: null, guardianPhone: guardian.phone } },
      include: {
        student: {
          select: {
            id: true,
            nameBn: true,
            roll: true,
            registrationNo: true,
            image: true,
            isActive: true,
            admissionStatus: true,
            classRef: { select: tenantClassNameSelect(madrasaId) },
          },
        },
      },
    });
  }

  findPublishedResultsForStudent(madrasaId: number, studentId: number) {
    return prisma.resultSummary.findMany({
      where: {
        studentId,
        resultMaster: { madrasaId, status: "PUBLISHED", deletedAt: null },
      },
      include: {
        resultMaster: {
          include: { exam: { select: { name: true } }, class: { select: tenantClassNameSelect(madrasaId) } },
        },
      },
      orderBy: { resultMaster: { createdAt: "desc" } },
    });
  }

  findNotices(madrasaId: number) {
    return prisma.websiteNotice.findMany({
      where: { madrasaId, isPublished: 1 },
      orderBy: { publishedAt: "desc" },
      take: GUARDIAN_NOTICES_LIMIT,
      select: { id: true, title: true, content: true, publishedAt: true },
    });
  }

  /** Student's current class id, scoped to the tenant - used to look up the
   * class's exam routine. Ownership is already asserted by the caller
   * (GuardianService#assertOwnsStudent) before this is ever called. */
  async findStudentClassId(madrasaId: number, studentId: number): Promise<number | null> {
    const student = await prisma.student.findFirst({
      where: { id: studentId, madrasaId, deletedAt: null },
      select: { classId: true },
    });
    return student?.classId ?? null;
  }

  /** One PUBLISHED result's full marksheet detail for a student - mirrors
   * findPublishedResultsForStudent's PUBLISHED-only filter so a guardian can
   * never reach a DRAFT result's marksheet by guessing a resultMasterId. */
  findResultSummaryDetail(madrasaId: number, studentId: number, resultMasterId: number) {
    return prisma.resultSummary.findFirst({
      where: {
        studentId,
        resultMasterId,
        resultMaster: { madrasaId, status: "PUBLISHED", deletedAt: null },
      },
      include: {
        resultMaster: {
          include: {
            exam: { select: { name: true, year: true } },
            class: { select: tenantClassNameSelect(madrasaId) },
          },
        },
        student: {
          select: { nameBn: true, roll: true, registrationNo: true, fatherName: true, dob: true },
        },
      },
    });
  }

  /** Per-subject marks for one student within one result session - joined
   * with the book/subject's display name for the marksheet's subject table. */
  async findMarksForResult(resultMasterId: number, studentId: number) {
    const marks = await prisma.mark.findMany({
      where: { resultMasterId, studentId },
      include: { book: { select: { nameBn: true, name: true } } },
      orderBy: { bookId: "asc" },
    });
    if (!marks.length) return marks;
    // Subject rows follow the madrasa's own কিতাব serial (MadrasaBook.sortOrder).
    const links = await prisma.madrasaBook.findMany({
      where: { madrasaId: marks[0].madrasaId, bookId: { in: marks.map((m) => m.bookId) } },
      select: { bookId: true, sortOrder: true },
    });
    const serial = new Map(links.map((l) => [l.bookId, l.sortOrder]));
    return marks.sort(
      (a, b) => (serial.get(a.bookId) ?? Number.MAX_SAFE_INTEGER) - (serial.get(b.bookId) ?? Number.MAX_SAFE_INTEGER),
    );
  }
}

export const guardianRepository = new GuardianRepository();
