import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  listPackages,
  getSubscriptions,
  getSubscription,
  previewSms,
  getTransactions,
  getUsage,
  createPurchaseRequest,
  getMyPurchaseRequests,
} from "./billing.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see shared/permissions/rbac-policy.ts).
router.get("/packages", rbacMiddleware("billing.view"), listPackages);
router.get("/subscriptions", rbacMiddleware("billing.view"), getSubscriptions);
router.get("/subscription", rbacMiddleware("billing.view"), getSubscription);
router.post("/sms/preview", rbacMiddleware("notifications.send"), previewSms);
router.get("/transactions", rbacMiddleware("billing.view"), getTransactions);
router.get("/usage", rbacMiddleware("billing.view"), getUsage);

router.post("/purchase-requests", rbacMiddleware("billing.purchase"), createPurchaseRequest);
router.get("/purchase-requests", rbacMiddleware("billing.view"), getMyPurchaseRequests);

export default router;
