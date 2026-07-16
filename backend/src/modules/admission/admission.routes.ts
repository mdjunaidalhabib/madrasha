import { Router } from "express";
import { createAdmission } from "./admission.controller";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";

const router = Router();

// SECURED ROUTE (LOGIN + TENANT REQUIRED)
router.post("/", tenantMiddleware, authMiddleware, createAdmission);

export default router;
