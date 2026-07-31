import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { sendNotification, getNotifications } from "./notification.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see
// shared/permissions/rbac-policy.ts).
router.post("/send", rbacMiddleware("notifications.send"), sendNotification);
router.get("/", rbacMiddleware("notifications.read"), getNotifications);

export default router;
