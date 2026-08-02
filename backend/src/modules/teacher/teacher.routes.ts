import { Router } from "express";
import {
  createTeacher,
  bulkCreateTeachers,
  getTeachers,
  getTeacherById,
  updateTeacher,
  updateTeachersBulk,
  deleteTeacher,
} from "./teacher.controller";

import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering teachers.* (see rbac-policy.ts).

router.post("/", rbacMiddleware("teachers.create"), createTeacher);
router.post("/bulk", rbacMiddleware("teachers.create"), bulkCreateTeachers);

// BULK UPDATE EXISTING TEACHERS FROM EXCEL (personal/employment info only)
router.post("/bulk-update", rbacMiddleware("teachers.update"), updateTeachersBulk);

router.get("/", rbacMiddleware("teachers.read"), getTeachers);
router.get("/:id", rbacMiddleware("teachers.read"), getTeacherById);

router.put("/:id", rbacMiddleware("teachers.update"), updateTeacher);
router.delete("/:id", rbacMiddleware("teachers.delete"), deleteTeacher);

export default router;
