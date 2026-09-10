import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  listExamCandidates,
  getExamCandidate,
  getEligibleStudents,
  registerCandidate,
  bulkRegisterCandidates,
  checkEligibility,
  bulkCheckEligibility,
  getEligibilitySettings,
  updateEligibilitySettings,
  updateCandidateStatus,
  bulkUpdateCandidateStatus,
  cancelCandidate,
} from "./exam-candidate.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see
// rbac.middleware.ts). exam_candidate.* / exam_eligibility.* are granted to
// TALIMAT by default alongside exam.* (see baseline-role-permissions.ts).

/* ================= REGISTRATION (specific paths before "/:id") ================= */
router.post("/register", rbacMiddleware("exam_candidate.manage"), registerCandidate);
router.post("/bulk-register", rbacMiddleware("exam_candidate.manage"), bulkRegisterCandidates);
router.post("/bulk-status", rbacMiddleware("exam_candidate.manage"), bulkUpdateCandidateStatus);

/* ================= ELIGIBILITY ================= */
router.get("/eligible-students", rbacMiddleware("exam_candidate.read"), getEligibleStudents);
router.get("/eligibility-settings", rbacMiddleware("exam_eligibility.read"), getEligibilitySettings);
router.put("/eligibility-settings", rbacMiddleware("exam_eligibility.manage"), updateEligibilitySettings);
router.post("/eligibility-check", rbacMiddleware("exam_eligibility.manage"), checkEligibility);
router.post("/bulk-eligibility-check", rbacMiddleware("exam_eligibility.manage"), bulkCheckEligibility);

/* ================= LIST / DETAIL / STATUS ================= */
router.get("/", rbacMiddleware("exam_candidate.read"), listExamCandidates);
router.get("/:id", rbacMiddleware("exam_candidate.read"), getExamCandidate);
router.put("/:id/status", rbacMiddleware("exam_candidate.manage"), updateCandidateStatus);
router.delete("/:id", rbacMiddleware("exam_candidate.manage"), cancelCandidate);

export default router;
