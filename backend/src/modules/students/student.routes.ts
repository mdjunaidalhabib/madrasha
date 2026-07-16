import express from "express";
import {
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  createStudent,
  createStudentsBulk,
} from "./student.controller";

import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import { studentIdParamSchema } from "./student.validation";

const router = express.Router();

/* =============================
   PROTECTED + TENANT ROUTES
============================= */

// CREATE SINGLE STUDENT
router.post("/admission", tenantMiddleware, authMiddleware, createStudent);

// CREATE BULK STUDENTS FROM EXCEL
router.post("/admission/bulk", tenantMiddleware, authMiddleware, createStudentsBulk);

// GET ALL
router.get("/", tenantMiddleware, authMiddleware, getStudents);

// GET SINGLE
router.get("/:id", tenantMiddleware, authMiddleware, validate(studentIdParamSchema), getStudentById);

// UPDATE
router.put("/:id", tenantMiddleware, authMiddleware, validate(studentIdParamSchema), updateStudent);

// DELETE
router.delete("/:id", tenantMiddleware, authMiddleware, validate(studentIdParamSchema), deleteStudent);

export default router;
