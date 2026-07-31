import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getExams,
  createExam,
  deleteExam,
  reorderExams,
  getGeneralGrades,
  saveGeneralGrade,
  deleteGeneralGrade,
  getMadrasaGrades,
  saveMadrasaGrade,
  deleteMadrasaGrade,
  getFailMark,
  updateFailMark,
} from "./exam.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering exam.* (see rbac-policy.ts).

/* ================= EXAM ================= */
router.get("/exams", rbacMiddleware("exam.read"), getExams);
router.post("/exams", rbacMiddleware("exam.manage"), createExam);
router.put("/exams/reorder", rbacMiddleware("exam.manage"), reorderExams);
router.delete("/exams/:id", rbacMiddleware("exam.manage"), deleteExam);

/* ================= GENERAL GRADES ================= */
router.get("/general-grades", rbacMiddleware("exam.read"), getGeneralGrades);
router.post("/general-grades", rbacMiddleware("exam.manage"), saveGeneralGrade);
router.delete("/general-grades/:id", rbacMiddleware("exam.manage"), deleteGeneralGrade);

/* ================= MADRASA GRADES ================= */
router.get("/madrasa-grades", rbacMiddleware("exam.read"), getMadrasaGrades);
router.post("/madrasa-grades", rbacMiddleware("exam.manage"), saveMadrasaGrade);
router.delete("/madrasa-grades/:id", rbacMiddleware("exam.manage"), deleteMadrasaGrade);

/* ================= SETTINGS ================= */
router.get("/fail-mark", rbacMiddleware("exam.read"), getFailMark);
router.post("/fail-mark", rbacMiddleware("exam.manage"), updateFailMark);

export default router;
