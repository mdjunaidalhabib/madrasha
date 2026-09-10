import { EligibilityStatus } from "@prisma/client";
import { examCandidateRepository, ExamCandidateRepository } from "./exam-candidate.repository";
import { sessionRepository, SessionRepository } from "../session/session.repository";
import { feeService, FeeService } from "../fee/fee.service";
import { attendanceRepository, AttendanceRepository } from "../attendance/attendance.repository";
import { ELIGIBILITY_DEFAULTS, ELIGIBILITY_SETTING_KEYS } from "./exam-candidate.constants";
import { UpdateEligibilitySettingsRequestDto } from "./exam-candidate.dto";
import { BadRequestError } from "../../shared/errors";

export interface EligibilitySettings {
  requireActiveStudent: boolean;
  requireApprovedAdmission: boolean;
  checkDues: boolean;
  checkAttendance: boolean;
  minAttendancePercent: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

const toBool = (value: string | null | undefined, fallback: boolean) =>
  value == null ? fallback : value === "true" || value === "1";

/**
 * Centralized eligibility engine for exam candidate registration. Reads
 * existing student/fee/attendance data - never a second, parallel copy of
 * any of that data - and combines it with per-madrasa configurable rule
 * toggles (stored as Setting rows, same pattern as exam fail-mark) to
 * decide ELIGIBLE/INELIGIBLE with human-readable reasons.
 */
export class EligibilityService {
  constructor(
    private readonly repository: ExamCandidateRepository = examCandidateRepository,
    private readonly sessions: SessionRepository = sessionRepository,
    private readonly fees: FeeService = feeService,
    private readonly attendances: AttendanceRepository = attendanceRepository,
  ) {}

  async getSettings(madrasaId: number): Promise<EligibilitySettings> {
    const keys = Object.values(ELIGIBILITY_SETTING_KEYS);
    const rows = await this.repository.findSettings(madrasaId, keys);
    return {
      requireActiveStudent: toBool(
        rows.get(ELIGIBILITY_SETTING_KEYS.REQUIRE_ACTIVE_STUDENT),
        ELIGIBILITY_DEFAULTS.requireActiveStudent,
      ),
      requireApprovedAdmission: toBool(
        rows.get(ELIGIBILITY_SETTING_KEYS.REQUIRE_APPROVED_ADMISSION),
        ELIGIBILITY_DEFAULTS.requireApprovedAdmission,
      ),
      checkDues: toBool(rows.get(ELIGIBILITY_SETTING_KEYS.CHECK_DUES), ELIGIBILITY_DEFAULTS.checkDues),
      checkAttendance: toBool(
        rows.get(ELIGIBILITY_SETTING_KEYS.CHECK_ATTENDANCE),
        ELIGIBILITY_DEFAULTS.checkAttendance,
      ),
      minAttendancePercent: Number(
        rows.get(ELIGIBILITY_SETTING_KEYS.MIN_ATTENDANCE_PERCENT) ?? ELIGIBILITY_DEFAULTS.minAttendancePercent,
      ),
    };
  }

  async updateSettings(madrasaId: number, dto: UpdateEligibilitySettingsRequestDto): Promise<EligibilitySettings> {
    const writes: Array<[string, string]> = [];

    if (dto.require_active_student !== undefined) {
      writes.push([ELIGIBILITY_SETTING_KEYS.REQUIRE_ACTIVE_STUDENT, String(Boolean(dto.require_active_student))]);
    }
    if (dto.require_approved_admission !== undefined) {
      writes.push([
        ELIGIBILITY_SETTING_KEYS.REQUIRE_APPROVED_ADMISSION,
        String(Boolean(dto.require_approved_admission)),
      ]);
    }
    if (dto.check_dues !== undefined) {
      writes.push([ELIGIBILITY_SETTING_KEYS.CHECK_DUES, String(Boolean(dto.check_dues))]);
    }
    if (dto.check_attendance !== undefined) {
      writes.push([ELIGIBILITY_SETTING_KEYS.CHECK_ATTENDANCE, String(Boolean(dto.check_attendance))]);
    }
    if (dto.min_attendance_percent !== undefined) {
      const pct = Number(dto.min_attendance_percent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        throw new BadRequestError("min_attendance_percent must be between 0 and 100");
      }
      writes.push([ELIGIBILITY_SETTING_KEYS.MIN_ATTENDANCE_PERCENT, String(pct)]);
    }

    for (const [name, value] of writes) {
      await this.repository.upsertSetting(madrasaId, name, value);
    }

    return this.getSettings(madrasaId);
  }

  /**
   * Evaluates one student's eligibility for one exam. `requireRegistration`
   * (true for an already-registered candidate being rechecked) adds a
   * "not registered" reason when somehow no candidate row exists yet -
   * left false for the registration-preview screen, where not being
   * registered yet is the whole point of looking.
   */
  async evaluate(
    madrasaId: number,
    params: { examId: number; studentId: number; isRegistered: boolean; requireRegistration: boolean },
  ): Promise<EligibilityResult> {
    const reasons: string[] = [];
    const settings = await this.getSettings(madrasaId);

    const student = await this.repository.findStudentForEligibility(madrasaId, params.studentId);
    if (!student) {
      return { eligible: false, reasons: ["শিক্ষার্থী পাওয়া যায়নি"] };
    }

    if (settings.requireActiveStudent && student.isActive !== 1) {
      reasons.push("শিক্ষার্থী সক্রিয় নয় (বহিষ্কৃত)");
    }
    if (settings.requireApprovedAdmission && student.admissionStatus !== "APPROVED") {
      reasons.push("শিক্ষার্থীর ভর্তি অনুমোদিত নয়");
    }
    if (params.requireRegistration && !params.isRegistered) {
      reasons.push("পরীক্ষায় নিবন্ধিত নয়");
    }

    if (settings.checkDues) {
      const statement = await this.fees.getStudentStatement(madrasaId, params.studentId);
      const totalDue = statement.summary.totalDue;
      if (totalDue > 0) {
        reasons.push(`বকেয়া ফি আছে (৳${totalDue.toLocaleString("bn-BD")})`);
      }
    }

    if (settings.checkAttendance) {
      const session = await this.sessions.findSessionForTenant(student.sessionId, madrasaId);
      if (session) {
        const from = session.startDate;
        const to = new Date();
        const grouped = (await this.attendances.getSummary(madrasaId, "STUDENT", student.id, from, to)) as Array<{
          status: string;
          _count: { _all: number };
        }>;
        const counts: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
        let total = 0;
        for (const row of grouped) {
          counts[row.status] = row._count._all;
          total += row._count._all;
        }
        if (total > 0) {
          const presentDays = counts.PRESENT + counts.LATE;
          const percentage = Math.round((presentDays / total) * 1000) / 10;
          if (percentage < settings.minAttendancePercent) {
            reasons.push(`উপস্থিতির হার প্রয়োজনীয় মাত্রার কম (${percentage}% < ${settings.minAttendancePercent}%)`);
          }
        }
      }
    }

    return { eligible: reasons.length === 0, reasons };
  }

  eligibilityStatusFrom(result: EligibilityResult): EligibilityStatus {
    return result.eligible ? EligibilityStatus.ELIGIBLE : EligibilityStatus.INELIGIBLE;
  }
}

export const eligibilityService = new EligibilityService();
