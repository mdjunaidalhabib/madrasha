import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  sendNotification,
  getNotifications,
  getNotificationDashboardSummary,
  getAudienceStudents,
  getAudienceTeachers,
  getAudienceResults,
  getNotificationSettings,
  updateNotificationSetting,
  updateNotificationMasterSetting,
} from "./notification.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see
// shared/permissions/rbac-policy.ts).
router.post("/send", rbacMiddleware("notifications.send"), sendNotification);
router.get("/", rbacMiddleware("notifications.read"), getNotifications);
router.get("/dashboard-summary", rbacMiddleware("notifications.read"), getNotificationDashboardSummary);

router.get("/audience/students", rbacMiddleware("notifications.send"), getAudienceStudents);
router.get("/audience/teachers", rbacMiddleware("notifications.send"), getAudienceTeachers);
router.get("/audience/results", rbacMiddleware("notifications.send"), getAudienceResults);

router.get("/settings", rbacMiddleware("notifications.settings"), getNotificationSettings);
// Registered before "/settings/:eventKey" - Express matches route patterns in
// registration order, so this literal path must come first or the param
// route below would swallow "/settings/master" as eventKey="master".
router.put("/settings/master", rbacMiddleware("notifications.settings"), updateNotificationMasterSetting);
router.put("/settings/:eventKey", rbacMiddleware("notifications.settings"), updateNotificationSetting);

export default router;
