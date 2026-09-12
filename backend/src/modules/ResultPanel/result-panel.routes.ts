import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware, requireAnyPermission } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  createSessionSchema,
  saveMarksSchema,
  processResultSchema,
  publishResultSchema,
  applyRollByRankSchema,
  deleteResultSchema,
} from "./result-panel.validation";
import {
  createSession,
  saveMarks,
  getMarks,
  processResult,
  getSummary,
  publishResult,
  applyRollByRank,
  deleteResult,
  getFullResultView,
  getClassStatus,
  getResultOverview,
  getResultDashboardSummary,
} from "./result-panel.controller";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering result.* (see rbac-policy.ts).

/* ================= SESSION ================= */
router.post("/session", rbacMiddleware("result.manage"), validate(createSessionSchema), createSession);

/* ================= MARKS ================= */
router.post("/marks", rbacMiddleware("result.manage"), validate(saveMarksSchema), saveMarks);
router.get("/marks", rbacMiddleware("result.read"), getMarks);

/* ================= RESULT PROCESS ================= */
router.post(
  "/process",
  requireAnyPermission("result.process", "result.manage"),
  validate(processResultSchema),
  processResult,
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

/* ================= DELETE ================= */
router.delete("/:id", rbacMiddleware("result.manage"), validate(deleteResultSchema), deleteResult);

/* ================= FULL RESULT ================= */
router.get("/full-result", rbacMiddleware("result.read"), getFullResultView);

export default router;
