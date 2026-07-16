import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import {
  getExams,
  createExam,
  deleteExam,
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

/* ================= EXAM ================= */
router.get("/exams", getExams);
router.post("/exams", createExam);
router.delete("/exams/:id", deleteExam);

/* ================= GENERAL GRADES ================= */
router.get("/general-grades", getGeneralGrades);
router.post("/general-grades", saveGeneralGrade);
router.delete("/general-grades/:id", deleteGeneralGrade);

/* ================= MADRASA GRADES ================= */
router.get("/madrasa-grades", getMadrasaGrades);
router.post("/madrasa-grades", saveMadrasaGrade);
router.delete("/madrasa-grades/:id", deleteMadrasaGrade);

/* ================= SETTINGS ================= */
router.get("/fail-mark", getFailMark);
router.post("/fail-mark", updateFailMark);

export default router;
