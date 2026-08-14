import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { getDashboard, getDashboardTrends } from "./dashboard.controller";

const router = Router();
router.get("/", tenantMiddleware, authMiddleware, subscriptionCheck, getDashboard);
router.get("/trends", tenantMiddleware, authMiddleware, subscriptionCheck, getDashboardTrends);
export default router;
