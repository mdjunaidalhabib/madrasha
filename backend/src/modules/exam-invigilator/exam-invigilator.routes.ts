import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware, requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  getInvigilatorAssignments,
  assignInvigilator,
  updateInvigilatorStatus,
  removeInvigilatorAssignment,
} from "./exam-invigilator.controller";
import {
  assignInvigilatorSchema,
  updateInvigilatorStatusSchema,
  removeInvigilatorAssignmentSchema,
} from "./exam-invigilator.validation";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Viewing an exam slot's invigilator list accepts ANY of these - not just
// exam.invigilator.read/exam.invigilator.manage, but also exam.schedule.read
// and routine.read, because this panel is embedded inline inside
// ClassExamRoutinePage (admin/src/features/routine/ClassExamRoutinePage.tsx),
// which itself is gated on routine.read - a user who can open that page must
// not hit a 403 loading the invigilator panel embedded in it. All mutations
// still require exam.invigilator.manage.
router.get(
  "/",
  requireAnyPermission("exam.invigilator.read", "exam.invigilator.manage", "exam.schedule.read", "routine.read"),
  getInvigilatorAssignments,
);
router.post(
  "/",
  rbacMiddleware("exam.invigilator.manage"),
  validate(assignInvigilatorSchema),
  assignInvigilator,
);
router.put(
  "/:id",
  rbacMiddleware("exam.invigilator.manage"),
  validate(updateInvigilatorStatusSchema),
  updateInvigilatorStatus,
);
router.delete(
  "/:id",
  rbacMiddleware("exam.invigilator.manage"),
  validate(removeInvigilatorAssignmentSchema),
  removeInvigilatorAssignment,
);

export default router;
