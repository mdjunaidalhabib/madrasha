import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  createExamSchema,
  updateExamSchema,
  deleteExamSchema,
  reorderExamsSchema,
  updateExamStatusSchema,
  saveGeneralGradeSchema,
  updateGeneralGradeSchema,
  deleteGeneralGradeSchema,
  saveMadrasaGradeSchema,
  updateMadrasaGradeSchema,
  deleteMadrasaGradeSchema,
  updateFailMarkSchema,
} from "./exam.validation";
import {
  getExams,
  createExam,
  updateExam,
  deleteExam,
  reorderExams,
  updateExamStatus,
  getGeneralGrades,
  saveGeneralGrade,
  updateGeneralGrade,
  deleteGeneralGrade,
  getMadrasaGrades,
  saveMadrasaGrade,
  updateMadrasaGrade,
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
router.post("/exams", rbacMiddleware("exam.manage"), validate(createExamSchema), createExam);
router.put("/exams/reorder", rbacMiddleware("exam.manage"), validate(reorderExamsSchema), reorderExams);
router.put("/exams/:id", rbacMiddleware("exam.manage"), validate(updateExamSchema), updateExam);
router.put("/exams/:id/status", rbacMiddleware("exam.manage"), validate(updateExamStatusSchema), updateExamStatus);
router.delete("/exams/:id", rbacMiddleware("exam.manage"), validate(deleteExamSchema), deleteExam);

/* ================= GENERAL GRADES ================= */
router.get("/general-grades", rbacMiddleware("exam.read"), getGeneralGrades);
router.post("/general-grades", rbacMiddleware("exam.manage"), validate(saveGeneralGradeSchema), saveGeneralGrade);
router.put(
  "/general-grades/:id",
  rbacMiddleware("exam.manage"),
  validate(updateGeneralGradeSchema),
  updateGeneralGrade,
);
router.delete(
  "/general-grades/:id",
  rbacMiddleware("exam.manage"),
  validate(deleteGeneralGradeSchema),
  deleteGeneralGrade,
);

/* ================= MADRASA GRADES ================= */
router.get("/madrasa-grades", rbacMiddleware("exam.read"), getMadrasaGrades);
router.post("/madrasa-grades", rbacMiddleware("exam.manage"), validate(saveMadrasaGradeSchema), saveMadrasaGrade);
router.put(
  "/madrasa-grades/:id",
  rbacMiddleware("exam.manage"),
  validate(updateMadrasaGradeSchema),
  updateMadrasaGrade,
);
router.delete(
  "/madrasa-grades/:id",
  rbacMiddleware("exam.manage"),
  validate(deleteMadrasaGradeSchema),
  deleteMadrasaGrade,
);

/* ================= SETTINGS ================= */
router.get("/fail-mark", rbacMiddleware("exam.read"), getFailMark);
router.post("/fail-mark", rbacMiddleware("exam.manage"), validate(updateFailMarkSchema), updateFailMark);

export default router;
