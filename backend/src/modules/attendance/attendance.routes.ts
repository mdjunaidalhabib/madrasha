import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  bulkMarkAttendance,
  correctAttendance,
  getAttendance,
  getAttendanceCalendar,
  getAttendanceDayInfo,
  getAttendanceHistory,
  getAttendancePolicy,
  getAttendanceRowHistory,
  getAttendanceStats,
  getAttendanceSummary,
  updateAttendancePolicy,
} from "./attendance.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering attendance.* (see rbac-policy.ts), so neither
// gets locked out by these checks. attendance.edit (old dates, device /
// leave rows) is checked inside the service via userHasPermission.

/* ================= ATTENDANCE ================= */
// Bulk-mark a whole class/day in one request (Student/Teacher/Staff share
// this same endpoint; `attendee_type` in the body picks which).
router.post("/bulk", rbacMiddleware("attendance.mark"), bulkMarkAttendance);

// List raw attendance rows for a date / date-range / class / attendee.
router.get("/", rbacMiddleware("attendance.read"), getAttendance);

// Month (or from/to) counts + working-day percentage for one attendee.
router.get("/summary", rbacMiddleware("attendance.read"), getAttendanceSummary);

// Same stats for many attendees (a class, explicit ids, or everybody).
router.get("/stats", rbacMiddleware("attendance.read"), getAttendanceStats);

// Audit trail of one attendee (optionally one date).
router.get("/history", rbacMiddleware("attendance.read"), getAttendanceHistory);

// Off day / edit-window info of one date for the mark screen.
router.get("/day-info", rbacMiddleware("attendance.read"), getAttendanceDayInfo);

// Working and off days of a range.
router.get("/calendar", rbacMiddleware("attendance.read"), getAttendanceCalendar);

// Per-madrasa attendance policy.
router.get("/policy", rbacMiddleware("attendance.read"), getAttendancePolicy);
router.put("/policy", rbacMiddleware("attendance.policy"), updateAttendancePolicy);

// Keep the /:id routes last so they never shadow the named paths above.
router.get("/:id/history", rbacMiddleware("attendance.read"), getAttendanceRowHistory);
router.patch("/:id", rbacMiddleware("attendance.mark"), correctAttendance);

export default router;
