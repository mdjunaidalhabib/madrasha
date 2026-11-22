import { Router } from "express";
import { getSidebar, streamSidebarChanges } from "./sidebar.controller";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";

const router = Router();

/* GET /api/sidebar */

router.get("/", tenantMiddleware, authMiddleware, getSidebar);
router.get("/events", tenantMiddleware, authMiddleware, streamSidebarChanges);

export default router;
