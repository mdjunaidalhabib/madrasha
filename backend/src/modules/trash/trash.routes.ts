import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getTrashedStudents,
  getTrashedTeachers,
  getTrashedExams,
  restoreStudent,
  restoreTeacher,
  restoreExam,
  permanentDeleteStudent,
  permanentDeleteTeacher,
  permanentDeleteExam,
} from "./trash.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Trash actions for each entity are gated by that entity's own existing
// delete/manage permission — no separate "trash" permission to seed.

/* ================= STUDENTS ================= */
router.get("/students", rbacMiddleware("students.delete"), getTrashedStudents);
router.post("/students/:id/restore", rbacMiddleware("students.delete"), restoreStudent);
router.delete("/students/:id", rbacMiddleware("students.delete"), permanentDeleteStudent);

/* ================= TEACHERS ================= */
router.get("/teachers", rbacMiddleware("teachers.delete"), getTrashedTeachers);
router.post("/teachers/:id/restore", rbacMiddleware("teachers.delete"), restoreTeacher);
router.delete("/teachers/:id", rbacMiddleware("teachers.delete"), permanentDeleteTeacher);

/* ================= EXAMS ================= */
router.get("/exams", rbacMiddleware("exam.manage"), getTrashedExams);
router.post("/exams/:id/restore", rbacMiddleware("exam.manage"), restoreExam);
router.delete("/exams/:id", rbacMiddleware("exam.manage"), permanentDeleteExam);

export default router;
