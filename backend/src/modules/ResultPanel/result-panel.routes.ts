import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import {
  createSession,
  saveMarks,
  getMarks,
  processResult,
  getSummary,
  publishResult,
  deleteResult,
  getFullResultView,
  getClassStatus,
  getResultOverview,
} from "./result-panel.controller";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

/* ================= SESSION ================= */
router.post("/session", createSession);

/* ================= MARKS ================= */
router.post("/marks", saveMarks);
router.get("/marks", getMarks);

/* ================= RESULT PROCESS ================= */
router.post("/process", processResult);

/* ================= SUMMARY ================= */
router.get("/summary", getSummary);

/* ================= CLASS STATUS (entry overview) ================= */
router.get("/class-status", getClassStatus);

/* ================= FULL OVERVIEW (all divisions/classes/exams) ================= */
router.get("/overview", getResultOverview);

/* ================= PUBLISH ================= */
router.post("/publish", publishResult);

/* ================= DELETE ================= */
router.delete("/:id", deleteResult);

/* ================= FULL RESULT ================= */
router.get("/full-result", getFullResultView);

export default router;
