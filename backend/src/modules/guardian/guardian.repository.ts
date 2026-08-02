import { prisma } from "../../shared/database/prisma";
import { GUARDIAN_NOTICES_LIMIT } from "./guardian.constants";

export class GuardianRepository {
  findActiveByPhone(madrasaId: number, phone: string) {
    return prisma.guardian.findFirst({ where: { madrasaId, phone, isActive: 1 } });
  }

  findByIdForTenant(id: number, madrasaId: number) {
    return prisma.guardian.findFirst({ where: { id, madrasaId, isActive: 1 } });
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
    const existing = await this.findActiveByPhone(params.madrasaId, params.phone);
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

  findOwnership(guardianId: number, studentId: number) {
    return prisma.guardianStudent.findUnique({
      where: { guardianId_studentId: { guardianId, studentId } },
    });
  }

  findChildrenForGuardian(guardianId: number, madrasaId: number) {
    return prisma.guardianStudent.findMany({
      where: { guardianId, student: { madrasaId, deletedAt: null } },
      include: {
        student: {
          select: {
            id: true,
            nameBn: true,
            roll: true,
            registrationNo: true,
            image: true,
            classRef: { select: { nameBn: true, name: true } },
          },
        },
      },
    });
  }

  findPublishedResultsForStudent(madrasaId: number, studentId: number) {
    return prisma.resultSummary.findMany({
      where: {
        studentId,
        resultMaster: { madrasaId, status: "PUBLISHED" },
      },
      include: {
        resultMaster: {
          include: { exam: { select: { name: true } }, class: { select: { nameBn: true, name: true } } },
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
}

export const guardianRepository = new GuardianRepository();
