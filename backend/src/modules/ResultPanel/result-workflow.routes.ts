import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import {
  getSubmissions,
  submitBook,
  verifyBook,
  rejectBook,
  verifyResult,
  decideApproval,
  lockResult,
} from "./result-workflow.controller";

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
  submitBook,
);
router.post(
  "/:resultMasterId/books/:bookId/verify",
  requireAnyPermission("marks.verify", "result.manage"),
  verifyBook,
);
router.post(
  "/:resultMasterId/books/:bookId/reject",
  requireAnyPermission("marks.verify", "result.manage"),
  rejectBook,
);

/* ================= RESULT-LEVEL VERIFY / APPROVE / LOCK ================= */
router.post(
  "/:resultMasterId/verify-result",
  requireAnyPermission("result.verify", "result.manage"),
  verifyResult,
);
router.post(
  "/:resultMasterId/approve",
  requireAnyPermission("result.approve", "result.manage"),
  decideApproval,
);
router.post("/:resultMasterId/lock", requireAnyPermission("result.lock", "result.manage"), lockResult);

export default router;
