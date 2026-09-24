import express from "express";
import {
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  createStudent,
  createStudentsBulk,
  updateStudentsBulk,
  lookupStudentByNid,
  getStudentIdByRegistrationNo,
  getNextRoll,
  getPendingAdmissions,
  approveAdmission,
  rejectAdmission,
  getRejectedAdmissions,
  permanentlyDeleteRejectedApplication,
  getFeePreview,
  setFeeDiscount,
  bulkDeleteStudents,
  expelStudent,
  setStudentInactive,
  transferStudentSession,
  getStudentsDashboardSummary,
} from "./student.controller";
import { getStudentProfile360 } from "../student-profile/student-profile.controller";

import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  studentIdParamSchema,
  registrationNoParamSchema,
  studentBulkDeleteSchema,
  studentExpelSchema,
  studentInactiveSchema,
  studentTransferSessionSchema,
} from "./student.validation";

const router = express.Router();

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering students.* (see rbac-policy.ts).

/* =============================
   PROTECTED + TENANT ROUTES
============================= */

// CREATE SINGLE STUDENT
router.post("/admission", tenantMiddleware, authMiddleware, rbacMiddleware("students.create"), createStudent);

// CREATE BULK STUDENTS FROM EXCEL
router.post(
  "/admission/bulk",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.create"),
  createStudentsBulk,
);

// BULK UPDATE EXISTING STUDENTS FROM EXCEL (personal/guardian/address info
// only - class/division/academic_year/roll are locked, see student.service.ts)
router.post(
  "/bulk-update",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.update"),
  updateStudentsBulk,
);

// LOOKUP BY NID (returning-student / re-admission check) - must be
// registered before the "/:id" route below, otherwise "lookup" would be
// parsed as an :id value.
router.get("/lookup", tenantMiddleware, authMiddleware, rbacMiddleware("students.read"), lookupStudentByNid);

// REGISTRATION NO -> ID (admin profile URLs show the madrasa's own reg no
// instead of the global DB id).
router.get(
  "/by-registration/:regNo",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.read"),
  validate(registrationNoParamSchema),
  getStudentIdByRegistrationNo,
);

// NEXT ROLL SUGGESTION for a class+academic year - same ordering rule as
// "/lookup" above, must come before "/:id".
router.get("/next-roll", tenantMiddleware, authMiddleware, rbacMiddleware("students.read"), getNextRoll);

// DASHBOARD SUMMARY (শিক্ষার্থী module dashboard) - same ordering rule as
// "/lookup" above, must come before "/:id".
router.get(
  "/dashboard-summary",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.read"),
  getStudentsDashboardSummary,
);

// ADMISSION APPROVAL WORKFLOW - must also be registered before "/:id"
router.get(
  "/admission/pending",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.approve_admission"),
  getPendingAdmissions,
);
router.patch(
  "/:id/approve",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.approve_admission"),
  approveAdmission,
);
router.patch(
  "/:id/reject",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.approve_admission"),
  rejectAdmission,
);
router.get(
  "/admission/rejected",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.approve_admission"),
  getRejectedAdmissions,
);
router.delete(
  "/:id/rejected-application",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.approve_admission"),
  permanentlyDeleteRejectedApplication,
);

// DETERMINED FEE LIST + PRE-APPROVAL DISCOUNT (see FeeService.previewStudentFees/
// setStudentFeeDiscount) - lets a Muhtamim see and waive/reduce a pending
// applicant's fees before ever approving them.
router.get(
  "/:id/fee-preview",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.approve_admission"),
  getFeePreview,
);
router.put(
  "/:id/fee-preview/:feeStructureId",
  tenantMiddleware,
  authMiddleware,
  // Same "invoice.waive" gate as waiving an actual invoice - deliberately
  // not under students.* / fee.* so only MUHTAMIM/SUPER_ADMIN (who bypass
  // rbacMiddleware) can grant a discount.
  rbacMiddleware("invoice.waive"),
  setFeeDiscount,
);

// EXPEL / UN-EXPEL - status flag only, does not move the student to Trash.
router.patch(
  "/:id/expel",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.expel"),
  validate(studentExpelSchema),
  expelStudent,
);

// INACTIVE / REACTIVATE - বহিষ্কার নয়, সাময়িক নিষ্ক্রিয় (isActive = 2); Trash-এ যায় না।
router.patch(
  "/:id/inactive",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.update"),
  validate(studentInactiveSchema),
  setStudentInactive,
);

// SESSION TRANSFER - direct reassignment into a different session.
router.patch(
  "/:id/transfer-session",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.transfer_session"),
  validate(studentTransferSessionSchema),
  transferStudentSession,
);

// GET ALL
router.get("/", tenantMiddleware, authMiddleware, rbacMiddleware("students.read"), getStudents);

// GET SINGLE
router.get(
  "/:id",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.read"),
  validate(studentIdParamSchema),
  getStudentById,
);

// STUDENT 360 - composed view (academic + attendance + fee + library +
// promotion history) aggregated from existing modules, read-only.
router.get(
  "/:id/profile-360",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.read"),
  validate(studentIdParamSchema),
  getStudentProfile360,
);

// UPDATE
router.put(
  "/:id",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.update"),
  validate(studentIdParamSchema),
  updateStudent,
);

// BULK DELETE (Student List "select many -> move to Trash") - must be
// registered before "/:id" below (same DELETE method), otherwise "/:id"
// would swallow "/bulk" with id="bulk", same ordering rule as "/lookup" above.
router.delete(
  "/bulk",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.delete"),
  validate(studentBulkDeleteSchema),
  bulkDeleteStudents,
);

// DELETE
router.delete(
  "/:id",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.delete"),
  validate(studentIdParamSchema),
  deleteStudent,
);

export default router;
