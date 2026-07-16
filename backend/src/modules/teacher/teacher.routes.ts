import { Router } from "express";
import {
  createTeacher,
  bulkCreateTeachers,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
} from "./teacher.controller";

import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.post("/", createTeacher);
router.post("/bulk", bulkCreateTeachers);

router.get("/", getTeachers);
router.get("/:id", getTeacherById);

router.put("/:id", updateTeacher);
router.delete("/:id", deleteTeacher);

export default router;
