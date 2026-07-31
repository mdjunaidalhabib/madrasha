import { comparePassword, hashPassword } from "../../shared/utils/hash.util";
import { generateToken } from "../../shared/utils/jwt.util";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { attendanceService } from "../attendance/attendance.service";
import { feeService } from "../fee/fee.service";
import { guardianRepository, GuardianRepository } from "./guardian.repository";
import {
  ACCOUNT_LOCKOUT_DURATION_MS,
  DEFAULT_PASSWORD_SUFFIX_LENGTH,
  GUARDIAN_TOKEN_EXPIRY,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "./guardian.constants";
import { GuardianChildSummary, GuardianLoginResult, GuardianNoticeRow, GuardianResultRow } from "./guardian.types";

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

  async getChildFees(guardianId: number, madrasaId: number, studentId: number) {
    await this.assertOwnsStudent(guardianId, studentId);
    return feeService.getStudentStatement(madrasaId, studentId);
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
