import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware, requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  createSessionSchema,
  saveMarksSchema,
  processResultSchema,
  recalculateResultsSchema,
  publishResultSchema,
  applyRollByRankSchema,
  deleteResultSchema,
} from "./result-panel.validation";
import {
  createSession,
  saveMarks,
  getMarks,
  processResult,
  recalculateResults,
  getSummary,
  publishResult,
  applyRollByRank,
  undoRollByRank,
  deleteResult,
  getFullResultView,
  getClassStatus,
  getResultOverview,
  getResultDashboardSummary,
} from "./result-panel.controller";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// bypasses every exam-department key (exam./marks./result./routine.) - see
// roleImpliesPermission in rbac-policy.ts.

/* ================= SESSION ================= */
// A role scoped down to just marks entry (marks.manage) or entry+submit
// (marks.submit) - the intended "ordinary teacher" grant, see
// RESULT_PERMISSIONS in ResultEntryPage.tsx - must be able to open/create a
// session and save marks without also holding the much broader
// result.manage (which additionally allows deleting results, roll-by-rank,
// etc). Mirrors the same OR pattern already used for mark-component config
// in mark-component.routes.ts.
router.post(
  "/session",
  requireAnyPermission("result.manage", "marks.manage", "marks.submit"),
  validate(createSessionSchema),
  createSession,
);

/* ================= MARKS ================= */
router.post(
  "/marks",
  requireAnyPermission("result.manage", "marks.manage", "marks.submit"),
  validate(saveMarksSchema),
  saveMarks,
);
router.get("/marks", requireAnyPermission("result.read", "marks.read", "marks.manage", "marks.submit", "marks.verify"), getMarks);

/* ================= RESULT PROCESS ================= */
router.post(
  "/process",
  requireAnyPermission("result.process", "result.manage"),
  validate(processResultSchema),
  processResult,
);

/* ================= RECALCULATE (any stage, incl. PUBLISHED/LOCKED) ================= */
// Re-grades processed sessions against the CURRENT fail mark / grade bands /
// subject setup - see ResultPanelService.recalculateResults for the
// published-result rules. Needs no reprocess-from-scratch, so it works after
// APPROVED/PUBLISHED where /process refuses.
router.post(
  "/recalculate",
  requireAnyPermission("result.process", "result.manage"),
  validate(recalculateResultsSchema),
  recalculateResults,
);

/* ================= SUMMARY ================= */
router.get("/summary", rbacMiddleware("result.read"), getSummary);

/* ================= CLASS STATUS (entry overview) ================= */
router.get("/class-status", rbacMiddleware("result.read"), getClassStatus);

/* ================= FULL OVERVIEW (all divisions/classes/exams) ================= */
// Backs the তালিমাত ফলাফল ওয়ার্কফ্লো (ResultWorkflowPage) queue screen, which
// a holder of ANY single workflow-stage permission (not just result.read/
// result.manage) is meant to be able to open - see that page's route guard
// in admin/src/app/router.tsx, which already lists this same permission set.
router.get(
  "/overview",
  requireAnyPermission(
    "result.read",
    "result.manage",
    "marks.submit",
    "marks.verify",
    "result.process",
    "result.verify",
    "result.approve",
    "result.publish",
    "result.lock",
    "result.correct",
  ),
  getResultOverview,
);

/* ================= DASHBOARD SUMMARY (তালিমাত module dashboard) ================= */
router.get("/dashboard-summary", rbacMiddleware("result.read"), getResultDashboardSummary);

/* ================= PUBLISH ================= */
router.post(
  "/publish",
  requireAnyPermission("result.publish", "result.manage"),
  validate(publishResultSchema),
  publishResult,
);

/* ================= APPLY ROLL BY RANK (merit-based roll reassignment) ================= */
router.post(
  "/apply-roll-by-rank",
  rbacMiddleware("result.manage"),
  validate(applyRollByRankSchema),
  applyRollByRank,
);
router.post(
  "/undo-roll-by-rank",
  rbacMiddleware("result.manage"),
  validate(applyRollByRankSchema),
  undoRollByRank,
);

/* ================= DELETE ================= */
router.delete("/:id", rbacMiddleware("result.manage"), validate(deleteResultSchema), deleteResult);

/* ================= FULL RESULT ================= */
router.get("/full-result", rbacMiddleware("result.read"), getFullResultView);

export default router;
