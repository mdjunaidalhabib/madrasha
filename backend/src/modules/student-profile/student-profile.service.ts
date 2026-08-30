import { studentRepository } from "../students/student.repository";
import { attendanceService } from "../attendance/attendance.service";
import { feeService } from "../fee/fee.service";
import { libraryService } from "../library/library.service";
import { promotionRepository } from "../promotion/promotion.repository";
import { resultPanelRepository } from "../ResultPanel/result-panel.repository";
import { NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";

const RECENT_INVOICE_COUNT = 5;
const ATTENDANCE_RECENT_DAYS = 30;

const EMPTY_FEE_STATEMENT = {
  invoices: [] as unknown[],
  summary: { totalBilled: 0, totalPaid: 0, totalWaived: 0, totalDue: 0 },
};

/** Unwraps one Promise.allSettled result, logging + falling back on failure
 * so one module's outage never blocks the rest of the 360 view. */
function settle<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  logger.error(`student-profile-360: ${label} failed`, result.reason);
  return fallback;
}

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export class StudentProfileService {
  async getProfile360(studentId: number, madrasaId: number) {
    const student = await studentRepository.findByIdForTenant(studentId, madrasaId);
    if (!student) throw new NotFoundError("Student not found");

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - ATTENDANCE_RECENT_DAYS);

    const [resultsOutcome, attendanceSummaryOutcome, attendanceRecentOutcome, feeOutcome, libraryOutcome, promotionOutcome] =
      await Promise.allSettled([
        resultPanelRepository.findByStudent(madrasaId, studentId),
        attendanceService.summary(madrasaId, { attendee_id: String(studentId), attendee_type: "STUDENT" }),
        attendanceService.list(madrasaId, {
          attendee_type: "STUDENT",
          attendee_id: String(studentId),
          from: toDateOnly(from),
          to: toDateOnly(to),
        }),
        feeService.getStudentStatement(madrasaId, studentId),
        libraryService.listBorrowRecords(madrasaId, { student_id: String(studentId) }),
        promotionRepository.getHistoryForStudent(studentId, madrasaId),
      ]);

    const results = settle(resultsOutcome, "results", [] as Awaited<ReturnType<typeof resultPanelRepository.findByStudent>>);
    const attendanceSummary = settle(attendanceSummaryOutcome, "attendance summary", null as any);
    const attendanceRecent = settle(attendanceRecentOutcome, "attendance recent", [] as any[]);
    const feeStatement = settle(feeOutcome, "fee statement", EMPTY_FEE_STATEMENT as any);
    const libraryRecords = settle(libraryOutcome, "library", [] as any[]);
    const promotionHistory = settle(promotionOutcome, "promotion history", [] as any[]);

    return {
      student,
      results,
      attendanceSummary: attendanceSummary ? { ...attendanceSummary, recent: attendanceRecent } : null,
      feeSummary: {
        totalDue: feeStatement.summary.totalDue,
        totalBilled: feeStatement.summary.totalBilled,
        totalPaid: feeStatement.summary.totalPaid,
        totalWaived: feeStatement.summary.totalWaived,
        recentInvoices: feeStatement.invoices.slice(0, RECENT_INVOICE_COUNT),
      },
      libraryRecords,
      promotionHistory,
    };
  }
}

export const studentProfileService = new StudentProfileService();
