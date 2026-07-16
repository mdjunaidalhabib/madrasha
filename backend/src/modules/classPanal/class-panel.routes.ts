import { Router } from "express";
import {
  getDivisions,
  getClasses,
  addClass,
  updateClass,
  deleteClass,
  getSubjects,
  addSubject,
  updateSubject,
  deleteSubject,
} from "./class-panel.controller";

import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";

const router = Router();

/* =========================
   DIVISIONS
========================= */
router.get(
  "/madrasa-divisions",
  tenantMiddleware,
  authMiddleware,
  getDivisions,
);

/* =========================
   CLASSES
========================= */
router.get("/madrasa-classes", tenantMiddleware, authMiddleware, getClasses);

router.post("/madrasa-classes", tenantMiddleware, authMiddleware, addClass);

router.put(
  "/madrasa-classes/:id",
  tenantMiddleware,
  authMiddleware,
  updateClass,
);

router.delete(
  "/madrasa-classes/:id",
  tenantMiddleware,
  authMiddleware,
  deleteClass,
);

/* =========================
   BOOKS
========================= */
router.get("/madrasa-books", tenantMiddleware, authMiddleware, getSubjects);

router.post("/madrasa-books", tenantMiddleware, authMiddleware, addSubject);

router.put(
  "/madrasa-books/:id",
  tenantMiddleware,
  authMiddleware,
  updateSubject,
);

router.delete(
  "/madrasa-books/:id",
  tenantMiddleware,
  authMiddleware,
  deleteSubject,
);

export default router;
