import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { getExamRooms, createExamRoom, updateExamRoom, deactivateExamRoom } from "./exam-room.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get("/", rbacMiddleware("exam.room.read"), getExamRooms);
router.post("/", rbacMiddleware("exam.room.manage"), createExamRoom);
router.put("/:id", rbacMiddleware("exam.room.manage"), updateExamRoom);
router.delete("/:id", rbacMiddleware("exam.room.manage"), deactivateExamRoom);

export default router;
