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

const router = Router();

/* =========================
   DIVISIONS
========================= */
router.get("/madrasa-divisions", tenantMiddleware, authMiddleware, getDivisions);

router.put("/madrasa-divisions/reorder", tenantMiddleware, authMiddleware, reorderDivisions);

router.put("/madrasa-divisions/:id", tenantMiddleware, authMiddleware, updateDivision);

router.delete("/madrasa-divisions/:id", tenantMiddleware, authMiddleware, deleteDivision);

/* =========================
   CLASSES
========================= */
router.get("/madrasa-classes", tenantMiddleware, authMiddleware, getClasses);

router.post("/madrasa-classes", tenantMiddleware, authMiddleware, addClass);

router.put("/madrasa-classes/reorder", tenantMiddleware, authMiddleware, reorderClasses);

router.put("/madrasa-classes/:id", tenantMiddleware, authMiddleware, updateClass);

router.delete("/madrasa-classes/:id", tenantMiddleware, authMiddleware, deleteClass);

/* =========================
   BOOKS
========================= */
router.get("/madrasa-books", tenantMiddleware, authMiddleware, getSubjects);

router.post("/madrasa-books", tenantMiddleware, authMiddleware, addSubject);

router.put("/madrasa-books/miyari", tenantMiddleware, authMiddleware, updateMiyariSubjects);

router.put("/madrasa-books/reorder", tenantMiddleware, authMiddleware, reorderSubjects);

router.put("/madrasa-books/:id", tenantMiddleware, authMiddleware, updateSubject);

router.get(
  "/madrasa-books/:id/delete-info",
  tenantMiddleware,
  authMiddleware,
  getSubjectDeleteInfo,
);

router.delete("/madrasa-books/:id", tenantMiddleware, authMiddleware, deleteSubject);

export default router;
