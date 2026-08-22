import { Router } from "express";
import {
  getDivisions,
  deleteDivision,
  updateDivision,
  reorderDivisions,
  getClasses,
  addClass,
  updateClass,
  deleteClass,
  reorderClasses,
  getSubjects,
  updateMiyariSubjects,
  reorderSubjects,
  addSubject,
  updateSubject,
  getSubjectDeleteInfo,
  deleteSubject,
} from "./class-panel.controller";

import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// GET routes are deliberately left ungated - they're consumed as dropdown/
// reference data by many unrelated pages (admission, attendance, fee,
// reports, routine...) across every role, not just this settings screen.
// Only the mutating endpoints are restricted.
const manage = rbacMiddleware("talimat.manage");

/* =========================
   DIVISIONS
========================= */
router.get("/madrasa-divisions", getDivisions);

router.put("/madrasa-divisions/reorder", manage, reorderDivisions);

router.put("/madrasa-divisions/:id", manage, updateDivision);

router.delete("/madrasa-divisions/:id", manage, deleteDivision);

/* =========================
   CLASSES
========================= */
router.get("/madrasa-classes", getClasses);

router.post("/madrasa-classes", manage, addClass);

router.put("/madrasa-classes/reorder", manage, reorderClasses);

router.put("/madrasa-classes/:id", manage, updateClass);

router.delete("/madrasa-classes/:id", manage, deleteClass);

/* =========================
   BOOKS
========================= */
router.get("/madrasa-books", getSubjects);

router.post("/madrasa-books", manage, addSubject);

router.put("/madrasa-books/miyari", manage, updateMiyariSubjects);

router.put("/madrasa-books/reorder", manage, reorderSubjects);

router.put("/madrasa-books/:id", manage, updateSubject);

router.get("/madrasa-books/:id/delete-info", getSubjectDeleteInfo);

router.delete("/madrasa-books/:id", manage, deleteSubject);

export default router;
