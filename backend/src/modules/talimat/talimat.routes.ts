import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { createResult, getMarksheet } from "./talimat.controller";

const router = Router();

router.post(
  "/create",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("talimat.manage"),
  createResult,
);
router.get(
  "/marksheet/:student_id",
  tenantMiddleware,
  authMiddleware,
  subscriptionCheck,
  rbacMiddleware("students.read"),
  getMarksheet,
);

export default router;
