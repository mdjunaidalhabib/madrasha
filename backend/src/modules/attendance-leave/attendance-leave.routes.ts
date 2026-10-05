import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  approveLeave,
  cancelLeave,
  createLeave,
  getConsecutiveAlerts,
  getLeave,
  listLeaves,
  rejectLeave,
} from "./attendance-leave.controller";

/** Mounted at /api/attendance-leaves (see attendance/ATTENDANCE_V3_API.md sections 2-3). */
const router = Router();

router.use(tenantMiddleware, authMiddleware);

/* ================= consecutive-absence alerts ================= */
// Declared before /:id so "alerts" is never parsed as an id.
router.get("/alerts/consecutive", rbacMiddleware("attendance.read"), getConsecutiveAlerts);

/* ================= leave requests ================= */
router.get("/", rbacMiddleware("attendance.read"), listLeaves);
router.get("/:id", rbacMiddleware("attendance.read"), getLeave);
router.post("/", rbacMiddleware("attendance.leave"), createLeave);
router.post("/:id/approve", rbacMiddleware("attendance.leave"), approveLeave);
router.post("/:id/reject", rbacMiddleware("attendance.leave"), rejectLeave);
router.post("/:id/cancel", rbacMiddleware("attendance.leave"), cancelLeave);

export default router;
