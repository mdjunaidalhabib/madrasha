import { Router } from "express";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { exportReportPdf } from "./controllers/report-export.controller";
import {
  getAcademicAdmissionReport,
  getAcademicResultNoticeReport,
  getAcademicResultsByRankReport,
  getAcademicResultsReport,
  getAcademicRoutineReport,
  getDailyAttendanceReport,
  getDigitalAttendanceReport,
  getExamNumberSheetReport,
  getExamSignatureSheetReport,
  getGuardianPhoneReport,
  getPrizeBookLabelsReport,
  getResidentialAttendanceReport,
} from "./controllers/academic-report.controller";
import {
  getStudentAdmitCardsReport,
  getStudentCertificatesReport,
  getStudentIdCardsReport,
  getStudentMarksheetsReport,
  getStudentSanadsReport,
  getStudentTransferLettersReport,
} from "./controllers/student-report.controller";
import {
  getTeacherListReport,
  getTeacherPhoneReport,
} from "./controllers/teacher-report.controller";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

// `reports.read` remains a superset that grants everything below - these
// per-category keys only ADD a narrower alternative grant, they never
// remove access from an existing `reports.read` holder.
const academicAccess = requireAnyPermission("reports.read", "reports.academic");
const examAccess = requireAnyPermission("reports.read", "reports.exam");
const attendanceAccess = requireAnyPermission("reports.read", "reports.attendance", "reports.academic");
const studentAccess = requireAnyPermission("reports.read", "reports.student");
const teacherAccess = requireAnyPermission("reports.read", "reports.teacher");

router.get("/academic/results", academicAccess, getAcademicResultsReport);
router.get("/academic/results-by-rank", academicAccess, getAcademicResultsByRankReport);
router.get("/academic/result-notice", academicAccess, getAcademicResultNoticeReport);
router.get("/academic/prize-book-labels", academicAccess, getPrizeBookLabelsReport);
router.get("/academic/routines", academicAccess, getAcademicRoutineReport);
router.get("/academic/admissions", academicAccess, getAcademicAdmissionReport);
router.get("/academic/guardian-phones", academicAccess, getGuardianPhoneReport);
router.get("/academic/exam-signature-sheet", examAccess, getExamSignatureSheetReport);
router.get("/academic/exam-number-sheet", examAccess, getExamNumberSheetReport);
router.get("/academic/residential-attendance", attendanceAccess, getResidentialAttendanceReport);
router.get("/academic/daily-attendance", attendanceAccess, getDailyAttendanceReport);
router.get("/academic/digital-attendance", attendanceAccess, getDigitalAttendanceReport);
router.get("/academic/id-cards", academicAccess, getStudentIdCardsReport);

router.get("/student/marksheets", studentAccess, getStudentMarksheetsReport);
router.get("/student/id-cards", studentAccess, getStudentIdCardsReport);
router.get("/student/admit-cards", studentAccess, getStudentAdmitCardsReport);
router.get("/student/sanads", studentAccess, getStudentSanadsReport);
router.get("/student/certificates", studentAccess, getStudentCertificatesReport);
router.get("/student/transfer-letters", studentAccess, getStudentTransferLettersReport);

router.get("/teacher/list", teacherAccess, getTeacherListReport);
router.get("/teacher/phones", teacherAccess, getTeacherPhoneReport);

// Server-side PDF export (Playwright) - see report-export.service.ts for why
// this replaced the old client-side html2canvas rendering. `reports.read`
// alone is enough since it's just a different output format of reports the
// requester can already view via the endpoints above.
router.post(
  "/export-pdf",
  requireAnyPermission("reports.read"),
  asyncHandler(exportReportPdf),
);

export default router;
