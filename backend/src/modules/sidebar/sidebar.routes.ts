import { Router } from "express";
import { getSidebar } from "./sidebar.controller";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";

const router = Router();

/* GET /api/sidebar */

router.get("/", tenantMiddleware, authMiddleware, getSidebar);

export default router;
