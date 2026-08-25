import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { listEvents, createEvent, updateEvent, deleteEvent } from "./event.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

router.get("/", rbacMiddleware("events.read"), listEvents);
router.post("/", rbacMiddleware("events.manage"), createEvent);
router.put("/:id", rbacMiddleware("events.manage"), updateEvent);
router.delete("/:id", rbacMiddleware("events.manage"), deleteEvent);

export default router;
