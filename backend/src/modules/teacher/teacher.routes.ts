import { Router } from "express";
import {
  createTeacher,
  bulkCreateTeachers,
  getTeachers,
  getTeacherDashboardSummary,
  getTeacherById,
  updateTeacher,
  updateTeachersBulk,
  deleteTeacher,
  updateTeacherNamesBulk,
} from "./teacher.controller";

import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { teacherNamesBulkSchema } from "./teacher.validation";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering teachers.* (see rbac-policy.ts).

router.post("/", rbacMiddleware("teachers.create"), createTeacher);
router.post("/bulk", rbacMiddleware("teachers.create"), bulkCreateTeachers);

// BULK UPDATE EXISTING TEACHERS FROM EXCEL (personal/employment info only)
router.post("/bulk-update", rbacMiddleware("teachers.update"), updateTeachersBulk);

// BULK NAMES - নাম (৩ ভাষা) page; only name_bn/name_ar/name_en. Registered
// before "/:id" so "names" is never parsed as an :id value.
router.patch("/names", rbacMiddleware("teachers.update"), validate(teacherNamesBulkSchema), updateTeacherNamesBulk);

router.get("/", rbacMiddleware("teachers.read"), getTeachers);
// Must be registered before "/:id" below, otherwise "dashboard-summary"
// would be parsed as an :id value.
router.get("/dashboard-summary", rbacMiddleware("teachers.read"), getTeacherDashboardSummary);
router.get("/:id", rbacMiddleware("teachers.read"), getTeacherById);

router.put("/:id", rbacMiddleware("teachers.update"), updateTeacher);
router.delete("/:id", rbacMiddleware("teachers.delete"), deleteTeacher);

export default router;
