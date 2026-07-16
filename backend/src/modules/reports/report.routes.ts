import { Router } from "express";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import {
  getAcademicAdmissionReport,
  getAcademicResultsReport,
  getAcademicRoutineReport,
  getGuardianPhoneReport,
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

router.get("/academic/results", getAcademicResultsReport);
router.get("/academic/routines", getAcademicRoutineReport);
router.get("/academic/admissions", getAcademicAdmissionReport);
router.get("/academic/guardian-phones", getGuardianPhoneReport);
router.get("/academic/residential-attendance", getResidentialAttendanceReport);
router.get("/academic/daily-attendance", getResidentialAttendanceReport);
router.get("/academic/digital-attendance", getResidentialAttendanceReport);
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
