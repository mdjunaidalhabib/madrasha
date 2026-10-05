import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  createSession,
  deleteSession,
  getSessionReport,
  getSessionSheet,
  listSessions,
  markSessionAttendance,
  updateSession,
} from "./attendance-session.controller";

/**
 * Sub-day (session) attendance - see attendance/ATTENDANCE_V3_API.md §4.
 * Mounted at /api/attendance-sessions.
 */
const router = Router();

router.use(tenantMiddleware, authMiddleware);

/* ================= SESSIONS ================= */
router.get("/sessions", rbacMiddleware("attendance.read"), listSessions);
router.post("/sessions", rbacMiddleware("attendance.session"), createSession);
router.patch("/sessions/:id", rbacMiddleware("attendance.session"), updateSession);
router.delete("/sessions/:id", rbacMiddleware("attendance.session"), deleteSession);

/* ================= MARKING ================= */
router.get("/sheet", rbacMiddleware("attendance.read"), getSessionSheet);
// Older than policy.editWindowDays additionally needs attendance.edit (checked in the service).
router.post("/mark", rbacMiddleware("attendance.mark"), markSessionAttendance);

/* ================= REPORT ================= */
router.get("/report", rbacMiddleware("attendance.read"), getSessionReport);

export default router;
