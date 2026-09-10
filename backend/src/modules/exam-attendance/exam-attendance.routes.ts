import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getExamAttendance,
  bulkMarkExamAttendance,
  updateExamAttendance,
  lockExamAttendance,
  unlockExamAttendance,
} from "./exam-attendance.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get("/", rbacMiddleware("exam.attendance.read"), getExamAttendance);
router.post("/bulk", rbacMiddleware("exam.attendance.manage"), bulkMarkExamAttendance);
router.put("/:id", rbacMiddleware("exam.attendance.manage"), updateExamAttendance);
router.post("/lock", rbacMiddleware("exam.attendance.manage"), lockExamAttendance);
router.post("/unlock", rbacMiddleware("exam.attendance.manage"), unlockExamAttendance);

export default router;
