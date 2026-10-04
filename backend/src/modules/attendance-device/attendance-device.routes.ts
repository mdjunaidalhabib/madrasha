import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware, requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { ADMIN_PERMISSIONS } from "./attendance-device.constants";
import {
  attendanceDeviceConnectorAuth,
  connectorFailedAuthLimiter,
  connectorIngestLimiter,
  connectorPollLimiter,
} from "./attendance-device.middleware";
import {
  assignPins,
  cancelEnrollment,
  clearCard,
  connectorCommands,
  convertPins,
  connectorConfig,
  connectorEnrollmentReport,
  connectorHeartbeat,
  connectorIngest,
  connectorUsers,
  createDevice,
  createEnrollment,
  createHoliday,
  deleteDevice,
  deleteHoliday,
  deleteMapping,
  deletePersonMap,
  getEnrollment,
  getSettings,
  listHolidays,
  listPeople,
  setCard,
  updateSettings,
  getSmsStatus,
  getToday,
  listDevices,
  listMappings,
  listUnmappedUsers,
  requestDeviceTest,
  rotateDeviceKey,
  setMapping,
  updateDevice,
} from "./attendance-device.controller";

/**
 * Mounted at /api/attendance-devices (before the "/"-root routers in
 * core/router.ts, same reason as /guardian and /billing there: those apply a
 * blanket authMiddleware that would otherwise swallow the connector routes).
 * Fully self-contained: applies its own tenantMiddleware.
 *
 * NOTE: MUHTAMIM/SUPER_ADMIN bypass rbacMiddleware. These
 * permissions deliberately have NO TALIMAT fallback (a leaked device key can
 * mark arbitrary attendance), so other roles need an explicit grant.
 */
const router = Router();
router.use(tenantMiddleware);

/* ================= CONNECTOR (device-key auth, no JWT) ================= */
const connector = Router();
connector.use(connectorFailedAuthLimiter, attendanceDeviceConnectorAuth);
connector.get("/config", connectorPollLimiter, connectorConfig);
connector.post("/heartbeat", connectorPollLimiter, connectorHeartbeat);
connector.post("/ingest", connectorIngestLimiter, connectorIngest);
connector.get("/users", connectorPollLimiter, connectorUsers);
connector.get("/commands", connectorPollLimiter, connectorCommands);
connector.post("/enrollments/:id", connectorPollLimiter, connectorEnrollmentReport);
router.use("/connector", connector);

/* ================= ADMIN ================= */
const canView = [authMiddleware, requireAnyPermission(ADMIN_PERMISSIONS.view, ADMIN_PERMISSIONS.manage)];
const canManage = [authMiddleware, rbacMiddleware(ADMIN_PERMISSIONS.manage)];

// "/devices/status" is registered before the "/devices/:id" routes.
router.get("/devices/status", ...canView, listDevices);
router.get("/devices", ...canView, listDevices);
router.post("/devices", ...canManage, createDevice);
router.patch("/devices/:id", ...canManage, updateDevice);
router.delete("/devices/:id", ...canManage, deleteDevice);
router.post("/devices/:id/rotate-key", ...canManage, rotateDeviceKey);
router.post("/devices/:id/request-test", ...canManage, requestDeviceTest);

router.get("/mappings", ...canView, listMappings);
router.put("/mappings", ...canManage, setMapping);
router.delete("/mappings/:studentId", ...canManage, deleteMapping);
router.get("/unmapped-users", ...canView, listUnmappedUsers);

router.get("/settings", ...canView, getSettings);
router.put("/settings", ...canManage, updateSettings);
router.get("/holidays", ...canView, listHolidays);
router.post("/holidays", ...canManage, createHoliday);
router.delete("/holidays/:id", ...canManage, deleteHoliday);

router.get("/people", ...canView, listPeople);
router.post("/people/assign-pins", ...canManage, assignPins);
router.post("/people/convert-pins", ...canManage, convertPins);
router.put("/people/card", ...canManage, setCard);
router.delete("/people/card/:attendeeType/:attendeeId", ...canManage, clearCard);
router.delete("/people/map/:attendeeType/:attendeeId", ...canManage, deletePersonMap);

router.post("/enrollments", ...canManage, createEnrollment);
router.get("/enrollments/:id", ...canView, getEnrollment);
router.post("/enrollments/:id/cancel", ...canManage, cancelEnrollment);

router.get("/today", ...canView, getToday);
router.get("/sms-status", ...canView, getSmsStatus);

export default router;
