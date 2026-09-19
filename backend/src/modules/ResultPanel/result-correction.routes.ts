import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  requestCorrection,
  requestCorrectionBatch,
  listCorrections,
  decideCorrection,
} from "./result-correction.controller";
import {
  requestCorrectionSchema,
  requestCorrectionBatchSchema,
  decideCorrectionSchema,
} from "./result-correction.validation";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

/* ================= CORRECTION REQUEST / LIST (only usable once PUBLISHED/LOCKED) ================= */
router.post(
  "/:resultMasterId/corrections",
  requireAnyPermission("result.correct", "result.manage"),
  validate(requestCorrectionSchema),
  requestCorrection,
);
router.post(
  "/:resultMasterId/corrections/batch",
  requireAnyPermission("result.correct", "result.manage"),
  validate(requestCorrectionBatchSchema),
  requestCorrectionBatch,
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
  validate(decideCorrectionSchema),
  decideCorrection,
);

export default router;
