import { comparePassword, hashPassword } from "../../shared/utils/hash.util";
import { generateToken } from "../../shared/utils/jwt.util";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { attendanceService } from "../attendance/attendance.service";
import { feeService } from "../fee/fee.service";
import { libraryService } from "../library/library.service";
import { promotionRepository } from "../promotion/promotion.repository";
import { routineRepository } from "../routine/routine.repository";
import { resultPanelRepository } from "../ResultPanel/result-panel.repository";
import { guardianRepository, GuardianRepository } from "./guardian.repository";
import {
  ACCOUNT_LOCKOUT_DURATION_MS,
  DEFAULT_PASSWORD_SUFFIX_LENGTH,
  GUARDIAN_TOKEN_EXPIRY,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "./guardian.constants";
import {
  GuardianChildSummary,
  GuardianExamRoutineRow,
  GuardianLoginResult,
  GuardianMarksheetDetail,
  GuardianNoticeRow,
  GuardianResultRow,
} from "./guardian.types";

const cleanPhone = (value: string | null | undefined) => String(value || "").trim();

export class GuardianService {
  constructor(private readonly repository: GuardianRepository = guardianRepository) {}

  /* ================= AUTO-PROVISIONING (called from student admission flows) ================= */

  /** Finds-or-creates a Guardian for (madrasaId, guardianPhone) and links
   * the given student to it. Idempotent - safe to call again for the same
   * student (e.g. a sibling admission, or a retried approval). Never throws
   * for a missing phone; it just skips (a student can legitimately have no
   * guardian phone on file). */
  async ensureGuardianForStudent(
    madrasaId: number,
    studentId: number,
    guardianPhone: string | null | undefined,
    fallbackName: string | null | undefined,
  ): Promise<void> {
    const phone = cleanPhone(guardianPhone);
    if (!phone) return;

    try {
      const defaultPassword = phone.slice(-DEFAULT_PASSWORD_SUFFIX_LENGTH);
      const passwordHash = await hashPassword(defaultPassword);

      const { guardian } = await this.repository.upsertGuardian({
        madrasaId,
        phone,
        name: fallbackName || null,
        passwordHash,
      });

      await this.repository.linkStudentIfMissing(guardian.id, studentId);
    } catch (err) {
      // Guardian provisioning must never block/roll back a student
      // admission - log and move on.
      logger.error("ensureGuardianForStudent failed", { madrasaId, studentId, err });
    }
  }

  /* ================= AUTH ================= */

  async login(phone: string, password: string, madrasaId: number): Promise<GuardianLoginResult> {
    const guardian = await this.repository.findActiveByPhone(madrasaId, cleanPhone(phone));
    if (!guardian) {
      throw new BadRequestError("Invalid credentials");
    }

    if (guardian.lockedUntil && guardian.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((guardian.lockedUntil.getTime() - Date.now()) / 60000);
      throw new BadRequestError(`Too many failed attempts. Try again in ${minutesLeft} minute(s).`);
    }

    const validPassword = await comparePassword(password, guardian.passwordHash);
    if (!validPassword) {
      const attempts = guardian.failedLoginAttempts + 1;
      const lockedUntil =
        attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS) : null;
      await this.repository.recordFailedLogin(guardian.id, attempts, lockedUntil);

      if (lockedUntil) {
        throw new BadRequestError(
          `Too many failed attempts. Account locked for ${ACCOUNT_LOCKOUT_DURATION_MS / 60000} minutes.`,
        );
      }
      throw new BadRequestError("Invalid credentials");
    }

    await this.repository.recordSuccessfulLogin(guardian.id);

    const token = generateToken(
      { type: "guardian", guardianId: guardian.id, madrasaId: guardian.madrasaId },
      GUARDIAN_TOKEN_EXPIRY,
    );

    return {
      token,
      guardian: {
        id: guardian.id,
        name: guardian.name,
        phone: guardian.phone,
        mustChangePassword: guardian.mustChangePassword,
      },
    };
  }

  async changePassword(guardianId: number, madrasaId: number, newPassword: string): Promise<void> {
    const guardian = await this.repository.findByIdForTenant(guardianId, madrasaId);
    if (!guardian) throw new NotFoundError("Guardian account not found");

    const passwordHash = await hashPassword(newPassword);
    await this.repository.updatePassword(guardian.id, passwordHash);
  }

  /* ================= OWNERSHIP ================= */

  private async assertOwnsStudent(guardianId: number, studentId: number): Promise<void> {
    const link = await this.repository.findOwnership(guardianId, studentId);
    if (!link) throw new ForbiddenError("You do not have access to this student's records");
  }

  /* ================= DATA ================= */

  async listMyChildren(guardianId: number, madrasaId: number): Promise<GuardianChildSummary[]> {
    const rows = await this.repository.findChildrenForGuardian(guardianId, madrasaId);
    return rows.map(({ student }) => ({
      id: student.id,
      nameBn: student.nameBn,
      roll: student.roll,
      registrationNo: student.registrationNo,
      className: student.classRef?.nameBn || student.classRef?.name || null,
      image: student.image,
    }));
  }

  async getChildAttendance(guardianId: number, madrasaId: number, studentId: number, month?: string) {
    await this.assertOwnsStudent(guardianId, studentId);

    const summary = await attendanceService.summary(madrasaId, {
      attendee_id: String(studentId),
      attendee_type: "STUDENT",
      month,
    });

    const recent = await attendanceService.list(madrasaId, {
      attendee_type: "STUDENT",
      attendee_id: String(studentId),
    });

    return { summary, recent };
  }

  async getChildResults(guardianId: number, madrasaId: number, studentId: number): Promise<GuardianResultRow[]> {
    await this.assertOwnsStudent(guardianId, studentId);

    const rows = await this.repository.findPublishedResultsForStudent(madrasaId, studentId);
    return rows.map((row) => ({
      resultMasterId: row.resultMasterId,
      examName: row.resultMaster.exam.name,
      className: row.resultMaster.class.nameBn || row.resultMaster.class.name || "",
      total: row.total,
      average: row.average,
      generalGrade: row.generalGrade,
      madrasaGrade: row.madrasaGrade,
      rankNo: row.rankNo,
      roll: row.roll,
    }));
  }

  /** Full subject-wise marksheet for one PUBLISHED result of the guardian's
   * own child - reuses the same PUBLISHED-only lookup as getChildResults, so
   * a guardian can never view (or print) a DRAFT marksheet by guessing a
   * resultMasterId that belongs to their child. */
  async getChildResultDetail(
    guardianId: number,
    madrasaId: number,
    studentId: number,
    resultMasterId: number,
  ): Promise<GuardianMarksheetDetail> {
    await this.assertOwnsStudent(guardianId, studentId);

    const detail = await this.repository.findResultSummaryDetail(madrasaId, studentId, resultMasterId);
    if (!detail) throw new NotFoundError("প্রকাশিত ফলাফল পাওয়া যায়নি");

    const [marks, subjects] = await Promise.all([
      this.repository.findMarksForResult(resultMasterId, studentId),
      resultPanelRepository.findActiveSubjectsForClass(madrasaId, detail.resultMaster.classId),
    ]);

    const fullMarksByBookId = new Map(subjects.filter((s) => s.book).map((s) => [s.book!.id, s.fullMark]));

    return {
      examName: detail.resultMaster.exam.name,
      examYear: detail.resultMaster.exam.year,
      className: detail.resultMaster.class.nameBn || detail.resultMaster.class.name || "",
      studentName: detail.student.nameBn,
      roll: detail.roll ?? detail.student.roll,
      registrationNo: detail.student.registrationNo,
      fatherName: detail.student.fatherName,
      dob: detail.student.dob,
      total: detail.total,
      average: detail.average,
      generalGrade: detail.generalGrade,
      madrasaGrade: detail.madrasaGrade,
      status: detail.status,
      rankNo: detail.rankNo,
      subjects: marks.map((m) => ({
        bookId: m.bookId,
        subjectName: m.book.nameBn || m.book.name || `বিষয় ${m.bookId}`,
        mark: m.isAbsent ? null : Number(m.mark),
        isAbsent: m.isAbsent,
        fullMarks: fullMarksByBookId.get(m.bookId) ?? null,
      })),
    };
  }

  /** Exam-day schedule for the guardian's own child's current class - reuses
   * RoutineRepository.findExamRoutines (the same query the admin Routine
   * module lists from) filtered to just that class, so this never exposes
   * anything beyond what's already visible admin-side. */
  async getChildExamRoutine(
    guardianId: number,
    madrasaId: number,
    studentId: number,
  ): Promise<GuardianExamRoutineRow[]> {
    await this.assertOwnsStudent(guardianId, studentId);

    const classId = await this.repository.findStudentClassId(madrasaId, studentId);
    if (!classId) return [];

    const rows = await routineRepository.findExamRoutines(madrasaId, undefined, classId);
    return rows.map((row) => ({
      id: row.id,
      examName: row.exam.name,
      examYear: row.exam.year,
      className: row.class.nameBn || row.class.name || "",
      subject: row.subject,
      examDate: row.examDate,
      startTime: row.startTime,
      endTime: row.endTime,
      roomNo: row.roomNo,
    }));
  }

  async getChildFees(guardianId: number, madrasaId: number, studentId: number) {
    await this.assertOwnsStudent(guardianId, studentId);
    return feeService.getStudentStatement(madrasaId, studentId);
  }

  async getChildLibrary(guardianId: number, madrasaId: number, studentId: number) {
    await this.assertOwnsStudent(guardianId, studentId);
    return libraryService.listBorrowRecords(madrasaId, { student_id: String(studentId) });
  }

  async getChildPromotion(guardianId: number, madrasaId: number, studentId: number) {
    await this.assertOwnsStudent(guardianId, studentId);
    return promotionRepository.getHistoryForStudent(studentId, madrasaId);
  }

  /** Combined read-only 360 view for the guardian's own child. Reuses each
   * per-section method above rather than re-implementing their queries -
   * every one of them re-checks ownership on its own (a cheap unique-index
   * lookup), so this stays safe on its own even if a section's internals
   * change later. Promise.allSettled means one section failing (e.g. the
   * fee module having a hiccup) never blocks the rest of the profile. */
  async getChildProfile360(guardianId: number, madrasaId: number, studentId: number) {
    await this.assertOwnsStudent(guardianId, studentId);

    const [attendance, results, fees, library, promotion] = await Promise.allSettled([
      this.getChildAttendance(guardianId, madrasaId, studentId),
      this.getChildResults(guardianId, madrasaId, studentId),
      this.getChildFees(guardianId, madrasaId, studentId),
      this.getChildLibrary(guardianId, madrasaId, studentId),
      this.getChildPromotion(guardianId, madrasaId, studentId),
    ]);

    const settle = <T>(result: PromiseSettledResult<T>, fallback: T, label: string): T => {
      if (result.status === "fulfilled") return result.value;
      logger.error(`guardian getChildProfile360: ${label} failed`, result.reason);
      return fallback;
    };

    return {
      attendance: settle(attendance, null as any, "attendance"),
      results: settle(results, [] as GuardianResultRow[], "results"),
      fees: settle(
        fees,
        { invoices: [], summary: { totalBilled: 0, totalPaid: 0, totalWaived: 0, totalDue: 0 } } as any,
        "fees",
      ),
      library: settle(library, [] as any[], "library"),
      promotion: settle(promotion, [] as any[], "promotion"),
    };
  }

  async getNotices(guardianId: number, madrasaId: number): Promise<GuardianNoticeRow[]> {
    // Notices aren't per-child, but still require a valid, logged-in
    // guardian - guardianId kept in the signature for consistency/future
    // per-class notice targeting.
    void guardianId;
    return this.repository.findNotices(madrasaId);
  }
}

export const guardianService = new GuardianService();
