import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { getExamRooms, createExamRoom, updateExamRoom, deactivateExamRoom } from "./exam-room.controller";
import { createExamRoomSchema, updateExamRoomSchema, deactivateExamRoomSchema } from "./exam-room.validation";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get("/", rbacMiddleware("exam.room.read"), getExamRooms);
router.post("/", rbacMiddleware("exam.room.manage"), validate(createExamRoomSchema), createExamRoom);
router.put("/:id", rbacMiddleware("exam.room.manage"), validate(updateExamRoomSchema), updateExamRoom);
router.delete("/:id", rbacMiddleware("exam.room.manage"), validate(deactivateExamRoomSchema), deactivateExamRoom);

export default router;
