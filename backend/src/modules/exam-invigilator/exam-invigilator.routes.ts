import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getInvigilatorAssignments,
  assignInvigilator,
  updateInvigilatorStatus,
  removeInvigilatorAssignment,
} from "./exam-invigilator.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Viewing an exam slot's invigilator list rides on exam.schedule.read (the
// task spec defines no separate exam.invigilator.read key); all mutations
// require exam.invigilator.manage.
router.get("/", rbacMiddleware("exam.schedule.read"), getInvigilatorAssignments);
router.post("/", rbacMiddleware("exam.invigilator.manage"), assignInvigilator);
router.put("/:id", rbacMiddleware("exam.invigilator.manage"), updateInvigilatorStatus);
router.delete("/:id", rbacMiddleware("exam.invigilator.manage"), removeInvigilatorAssignment);

export default router;
