import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getTrashedStudents,
  getTrashedTeachers,
  getTrashedExams,
  getTrashedDivisions,
  getTrashedClasses,
  getTrashedBooks,
  getTrashedResults,
  restoreStudent,
  restoreTeacher,
  restoreExam,
  restoreDivision,
  restoreClass,
  restoreBook,
  restoreResult,
  permanentDeleteStudent,
  permanentDeleteTeacher,
  permanentDeleteExam,
  permanentDeleteDivision,
  permanentDeleteClass,
  permanentDeleteBook,
  permanentDeleteResult,
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

// Division/Class/Book delete has no RBAC gate today either (see
// class-panel.routes.ts) — trash access mirrors that, since gating trash
// more tightly than the underlying delete action would be inconsistent.
/* ================= DIVISIONS ================= */
router.get("/divisions", getTrashedDivisions);
router.post("/divisions/:id/restore", restoreDivision);
router.delete("/divisions/:id", permanentDeleteDivision);

/* ================= CLASSES ================= */
router.get("/classes", getTrashedClasses);
router.post("/classes/:id/restore", restoreClass);
router.delete("/classes/:id", permanentDeleteClass);

/* ================= BOOKS ================= */
router.get("/books", getTrashedBooks);
router.post("/books/:id/restore", restoreBook);
router.delete("/books/:id", permanentDeleteBook);

/* ================= RESULTS ================= */
router.get("/results", rbacMiddleware("result.manage"), getTrashedResults);
router.post("/results/:id/restore", rbacMiddleware("result.manage"), restoreResult);
router.delete("/results/:id", rbacMiddleware("result.manage"), permanentDeleteResult);

export default router;
