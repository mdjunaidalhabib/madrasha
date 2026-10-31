import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getAssignments,
  getAllAssignments,
  getAssignmentCatalog,
  saveAssignment,
  saveGroupedAssignment,
  updateAssignment,
  deleteAssignment,
  deleteTeacherAssignments,
} from "./teacher-assignment.controller";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware, rbacMiddleware("talimat.manage"));

router.get("/", getAssignments);
router.get("/all", getAllAssignments);
router.get("/catalog", getAssignmentCatalog);

router.post("/", saveAssignment);
router.post("/batch", saveGroupedAssignment);
router.put("/batch", saveGroupedAssignment);
router.put("/", updateAssignment);

// Delete via POST body (avoids DELETE-with-body compatibility issues)
router.post("/delete", deleteAssignment);
router.post("/delete-teacher", deleteTeacherAssignments);

export default router;
