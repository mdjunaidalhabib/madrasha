import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  applyPayrollDeductions,
  getLowAttendance,
  getOverview,
  getPayrollSummary,
  getTrend,
} from "./attendance-analytics.controller";

/**
 * Attendance dashboard + payroll link - see attendance/ATTENDANCE_V3_API.md §5.
 * Mounted at /api/attendance-analytics.
 */
const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get("/overview", rbacMiddleware("attendance.read"), getOverview);
router.get("/trend", rbacMiddleware("attendance.read"), getTrend);
router.get("/low-attendance", rbacMiddleware("attendance.read"), getLowAttendance);

router.get("/payroll-summary", rbacMiddleware("payroll.read"), getPayrollSummary);
router.post("/payroll-apply", rbacMiddleware("payroll.manage"), applyPayrollDeductions);

export default router;
