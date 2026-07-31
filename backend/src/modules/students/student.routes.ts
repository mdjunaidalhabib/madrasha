import express from "express";
import {
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  createStudent,
  createStudentsBulk,
  lookupStudentByNid,
  getNextRoll,
  getPendingAdmissions,
  approveAdmission,
  rejectAdmission,
} from "./student.controller";

import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { studentIdParamSchema } from "./student.validation";

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

// LOOKUP BY NID (returning-student / re-admission check) - must be
// registered before the "/:id" route below, otherwise "lookup" would be
// parsed as an :id value.
router.get("/lookup", tenantMiddleware, authMiddleware, rbacMiddleware("students.read"), lookupStudentByNid);

// NEXT ROLL SUGGESTION for a class+academic year - same ordering rule as
// "/lookup" above, must come before "/:id".
router.get("/next-roll", tenantMiddleware, authMiddleware, rbacMiddleware("students.read"), getNextRoll);

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

// UPDATE
router.put(
  "/:id",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("students.update"),
  validate(studentIdParamSchema),
  updateStudent,
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
