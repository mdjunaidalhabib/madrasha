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
  verifyResult,
  decideApproval,
  lockResult,
} from "./result-workflow.controller";
import {
  submitBookSchema,
  verifyBookSchema,
  rejectBookSchema,
  verifyResultSchema,
  decideApprovalSchema,
  lockResultSchema,
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

/* ================= RESULT-LEVEL VERIFY / APPROVE / LOCK ================= */
router.post(
  "/:resultMasterId/verify-result",
  requireAnyPermission("result.verify", "result.manage"),
  validate(verifyResultSchema),
  verifyResult,
);
router.post(
  "/:resultMasterId/approve",
  requireAnyPermission("result.approve", "result.manage"),
  validate(decideApprovalSchema),
  decideApproval,
);
router.post(
  "/:resultMasterId/lock",
  requireAnyPermission("result.lock", "result.manage"),
  validate(lockResultSchema),
  lockResult,
);

export default router;
