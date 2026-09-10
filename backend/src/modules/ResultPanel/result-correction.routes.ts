import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { requestCorrection, listCorrections, decideCorrection } from "./result-correction.controller";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

/* ================= CORRECTION REQUEST / LIST (only usable once PUBLISHED/LOCKED) ================= */
router.post(
  "/:resultMasterId/corrections",
  requireAnyPermission("result.correct", "result.manage"),
  requestCorrection,
);
router.get(
  "/:resultMasterId/corrections",
  requireAnyPermission("result.correct", "result.read", "result.manage"),
  listCorrections,
);

/* ================= CORRECTION DECISION ================= */
router.post(
  "/corrections/:correctionId/decide",
  requireAnyPermission("result.approve", "result.manage"),
  decideCorrection,
);

export default router;
