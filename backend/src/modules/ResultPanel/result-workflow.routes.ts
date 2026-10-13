import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  getSubmissions,
  submitBook,
  verifyBook,
  rejectBook,
  unpublishResult,
} from "./result-workflow.controller";
import {
  submitBookSchema,
  verifyBookSchema,
  rejectBookSchema,
  unpublishResultSchema,
} from "./result-workflow.validation";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware. Every route below
// accepts its new specific permission OR the legacy "result.manage" so a
// madrasa that customized roles before this workflow shipped doesn't lose
// access (see result-panel.routes.ts's identical convention).

/* ================= SUBJECT-LEVEL SUBMISSION / VERIFICATION ================= */
router.get(
  "/:resultMasterId/submissions",
  requireAnyPermission("marks.read", "result.read"),
  getSubmissions,
);
router.post(
  "/:resultMasterId/books/:bookId/submit",
  requireAnyPermission("marks.submit", "result.manage"),
  validate(submitBookSchema),
  submitBook,
);
router.post(
  "/:resultMasterId/books/:bookId/verify",
  requireAnyPermission("marks.verify", "result.manage"),
  validate(verifyBookSchema),
  verifyBook,
);
router.post(
  "/:resultMasterId/books/:bookId/reject",
  requireAnyPermission("marks.verify", "result.manage"),
  validate(rejectBookSchema),
  rejectBook,
);

/* ================= UNPUBLISH (publishing itself is POST /results/publish) ================= */
router.post(
  "/:resultMasterId/unpublish",
  requireAnyPermission("result.publish", "result.manage"),
  validate(unpublishResultSchema),
  unpublishResult,
);

export default router;
