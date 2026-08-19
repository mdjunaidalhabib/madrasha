import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  sendNotification,
  getNotifications,
  getAudienceStudents,
  getAudienceTeachers,
  getAudienceResults,
  getNotificationSettings,
  updateNotificationSetting,
  getNotificationBalance,
} from "./notification.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see
// shared/permissions/rbac-policy.ts).
router.post("/send", rbacMiddleware("notifications.send"), sendNotification);
router.get("/", rbacMiddleware("notifications.read"), getNotifications);

router.get("/audience/students", rbacMiddleware("notifications.send"), getAudienceStudents);
router.get("/audience/teachers", rbacMiddleware("notifications.send"), getAudienceTeachers);
router.get("/audience/results", rbacMiddleware("notifications.send"), getAudienceResults);

router.get("/settings", rbacMiddleware("notifications.settings"), getNotificationSettings);
router.put("/settings/:eventKey", rbacMiddleware("notifications.settings"), updateNotificationSetting);

router.get("/balance", rbacMiddleware("notifications.send"), getNotificationBalance);

export default router;
