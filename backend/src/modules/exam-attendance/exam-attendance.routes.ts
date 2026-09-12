import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  getExamAttendance,
  bulkMarkExamAttendance,
  updateExamAttendance,
  lockExamAttendance,
  unlockExamAttendance,
} from "./exam-attendance.controller";
import {
  bulkMarkExamAttendanceSchema,
  updateExamAttendanceSchema,
  lockExamAttendanceSchema,
  unlockExamAttendanceSchema,
} from "./exam-attendance.validation";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get("/", rbacMiddleware("exam.attendance.read"), getExamAttendance);
router.post(
  "/bulk",
  rbacMiddleware("exam.attendance.manage"),
  validate(bulkMarkExamAttendanceSchema),
  bulkMarkExamAttendance,
);
router.put("/:id", rbacMiddleware("exam.attendance.manage"), validate(updateExamAttendanceSchema), updateExamAttendance);
router.post("/lock", rbacMiddleware("exam.attendance.manage"), validate(lockExamAttendanceSchema), lockExamAttendance);
router.post(
  "/unlock",
  rbacMiddleware("exam.attendance.manage"),
  validate(unlockExamAttendanceSchema),
  unlockExamAttendance,
);

export default router;
