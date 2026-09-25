import { Router } from "express";
import {
  createStaff,
  getStaffList,
  getStaffDashboardSummary,
  getStaffById,
  updateStaff,
  deleteStaff,
  updateStaffNamesBulk,
} from "./staff.controller";

import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { staffNamesBulkSchema } from "./staff.validation";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see rbac-policy.ts).

router.post("/", rbacMiddleware("staff.create"), createStaff);

// BULK NAMES - নাম (৩ ভাষা) page; only name_bn/name_ar/name_en. Registered
// before "/:id" so "names" is never parsed as an :id value.
router.patch("/names", rbacMiddleware("staff.update"), validate(staffNamesBulkSchema), updateStaffNamesBulk);

router.get("/", rbacMiddleware("staff.read"), getStaffList);
// Must be registered before "/:id" below, otherwise "dashboard-summary"
// would be parsed as an :id value.
router.get("/dashboard-summary", rbacMiddleware("staff.read"), getStaffDashboardSummary);
router.get("/:id", rbacMiddleware("staff.read"), getStaffById);

router.put("/:id", rbacMiddleware("staff.update"), updateStaff);
router.delete("/:id", rbacMiddleware("staff.delete"), deleteStaff);

export default router;
