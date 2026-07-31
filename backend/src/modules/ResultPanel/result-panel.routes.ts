import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
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
} from "./result-panel.controller";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering result.* (see rbac-policy.ts).

/* ================= SESSION ================= */
router.post("/session", rbacMiddleware("result.manage"), createSession);

/* ================= MARKS ================= */
router.post("/marks", rbacMiddleware("result.manage"), saveMarks);
router.get("/marks", rbacMiddleware("result.read"), getMarks);

/* ================= RESULT PROCESS ================= */
router.post("/process", rbacMiddleware("result.manage"), processResult);

/* ================= SUMMARY ================= */
router.get("/summary", rbacMiddleware("result.read"), getSummary);

/* ================= CLASS STATUS (entry overview) ================= */
router.get("/class-status", rbacMiddleware("result.read"), getClassStatus);

/* ================= FULL OVERVIEW (all divisions/classes/exams) ================= */
router.get("/overview", rbacMiddleware("result.read"), getResultOverview);

/* ================= PUBLISH ================= */
router.post("/publish", rbacMiddleware("result.manage"), publishResult);

/* ================= APPLY ROLL BY RANK (merit-based roll reassignment) ================= */
router.post("/apply-roll-by-rank", rbacMiddleware("result.manage"), applyRollByRank);

/* ================= DELETE ================= */
router.delete("/:id", rbacMiddleware("result.manage"), deleteResult);

/* ================= FULL RESULT ================= */
router.get("/full-result", rbacMiddleware("result.read"), getFullResultView);

export default router;
