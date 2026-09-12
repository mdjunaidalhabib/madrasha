import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  listExamCandidates,
  getExamCandidate,
  getEligibleStudents,
  checkEligibility,
  bulkCheckEligibility,
  getEligibilitySettings,
  updateEligibilitySettings,
  updateCandidateStatus,
  bulkUpdateCandidateStatus,
  cancelCandidate,
} from "./exam-candidate.controller";
import {
  bulkUpdateCandidateStatusSchema,
  eligibilityCheckSchema,
  bulkCheckEligibilitySchema,
  updateEligibilitySettingsSchema,
  updateCandidateStatusSchema,
  cancelCandidateSchema,
} from "./exam-candidate.validation";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware (see
// rbac.middleware.ts). exam_candidate.* / exam_eligibility.* are granted to
// TALIMAT by default alongside exam.* (see baseline-role-permissions.ts).

/* ================= REGISTRATION =================
   No manual register/bulk-register endpoints - candidates are created only
   by the two automatic triggers in exam-candidate.service.ts
   (autoRegisterForRoutine / autoRegisterOnInvoicePaid), invoked as side
   effects from routine.service.ts and fee.service.ts respectively. */
router.post(
  "/bulk-status",
  rbacMiddleware("exam_candidate.manage"),
  validate(bulkUpdateCandidateStatusSchema),
  bulkUpdateCandidateStatus,
);

/* ================= ELIGIBILITY ================= */
router.get("/eligible-students", rbacMiddleware("exam_candidate.read"), getEligibleStudents);
router.get("/eligibility-settings", rbacMiddleware("exam_eligibility.read"), getEligibilitySettings);
router.put(
  "/eligibility-settings",
  rbacMiddleware("exam_eligibility.manage"),
  validate(updateEligibilitySettingsSchema),
  updateEligibilitySettings,
);
router.post(
  "/eligibility-check",
  rbacMiddleware("exam_eligibility.manage"),
  validate(eligibilityCheckSchema),
  checkEligibility,
);
router.post(
  "/bulk-eligibility-check",
  rbacMiddleware("exam_eligibility.manage"),
  validate(bulkCheckEligibilitySchema),
  bulkCheckEligibility,
);

/* ================= LIST / DETAIL / STATUS ================= */
router.get("/", rbacMiddleware("exam_candidate.read"), listExamCandidates);
router.get("/:id", rbacMiddleware("exam_candidate.read"), getExamCandidate);
router.put(
  "/:id/status",
  rbacMiddleware("exam_candidate.manage"),
  validate(updateCandidateStatusSchema),
  updateCandidateStatus,
);
router.delete("/:id", rbacMiddleware("exam_candidate.manage"), validate(cancelCandidateSchema), cancelCandidate);

export default router;
