import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { getMarkComponents, saveMarkComponents } from "./mark-component.controller";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

/* ================= MARK-DISTRIBUTION COMPONENTS ================= */
router.get("/mark-components", requireAnyPermission("marks.read", "result.read"), getMarkComponents);
router.put("/mark-components", requireAnyPermission("marks.manage", "result.manage"), saveMarkComponents);

export default router;
