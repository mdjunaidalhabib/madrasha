import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { getLogs } from "./activity.controller";

const router = Router();

router.get("/", tenantMiddleware, authMiddleware, subscriptionCheck, rbacMiddleware("activity.read"), getLogs);

export default router;
