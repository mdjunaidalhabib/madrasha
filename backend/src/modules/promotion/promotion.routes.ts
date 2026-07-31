import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { previewPromotion, executePromotion } from "./promotion.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering students.* (see rbac-policy.ts).

// Preview which students would be promoted/retained before committing.
router.post("/preview", rbacMiddleware("students.read"), previewPromotion);

// Commit a reviewed promotion batch.
router.post("/execute", rbacMiddleware("students.promote"), executePromotion);

export default router;
