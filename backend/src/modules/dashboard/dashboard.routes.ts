import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { getDashboard, getDashboardTrends } from "./dashboard.controller";
import { getPublicVendorPromo } from "../super-admin/vendor-promo.controller";

const router = Router();
router.get("/", tenantMiddleware, authMiddleware, subscriptionCheck, getDashboard);
router.get("/trends", tenantMiddleware, authMiddleware, subscriptionCheck, getDashboardTrends);
// Super-Admin-authored "Hikmah IT" promo card content - same auth chain as
// the dashboard itself, read-only for tenant users.
router.get("/vendor-promo", tenantMiddleware, authMiddleware, subscriptionCheck, getPublicVendorPromo);
export default router;
