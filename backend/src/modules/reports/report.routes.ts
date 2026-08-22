import { Router } from "express";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
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
router.use(rbacMiddleware("reports.read"));

router.get("/academic/results", getAcademicResultsReport);
router.get("/academic/results-by-rank", getAcademicResultsByRankReport);
router.get("/academic/result-notice", getAcademicResultNoticeReport);
router.get("/academic/prize-book-labels", getPrizeBookLabelsReport);
router.get("/academic/routines", getAcademicRoutineReport);
router.get("/academic/admissions", getAcademicAdmissionReport);
router.get("/academic/guardian-phones", getGuardianPhoneReport);
router.get("/academic/exam-signature-sheet", getExamSignatureSheetReport);
router.get("/academic/exam-number-sheet", getExamNumberSheetReport);
router.get("/academic/residential-attendance", getResidentialAttendanceReport);
router.get("/academic/daily-attendance", getDailyAttendanceReport);
router.get("/academic/digital-attendance", getDigitalAttendanceReport);
router.get("/academic/id-cards", getStudentIdCardsReport);

router.get("/student/marksheets", getStudentMarksheetsReport);
router.get("/student/id-cards", getStudentIdCardsReport);
router.get("/student/admit-cards", getStudentAdmitCardsReport);
router.get("/student/sanads", getStudentSanadsReport);
router.get("/student/certificates", getStudentCertificatesReport);
router.get("/student/transfer-letters", getStudentTransferLettersReport);

router.get("/teacher/list", getTeacherListReport);
router.get("/teacher/phones", getTeacherPhoneReport);

export default router;
