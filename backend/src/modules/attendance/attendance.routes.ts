import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { bulkMarkAttendance, getAttendance, getAttendanceSummary } from "./attendance.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering attendance.* (see rbac-policy.ts), so neither
// gets locked out by these checks.

/* ================= ATTENDANCE ================= */
// Bulk-mark a whole class/day in one request (Student/Teacher/Staff share
// this same endpoint; `attendee_type` in the body picks which).
router.post("/bulk", rbacMiddleware("attendance.mark"), bulkMarkAttendance);

// List raw attendance rows for a date / date-range / class / attendee.
router.get("/", rbacMiddleware("attendance.read"), getAttendance);

// Monthly present/absent/late/leave summary + percentage for one attendee.
router.get("/summary", rbacMiddleware("attendance.read"), getAttendanceSummary);

export default router;
