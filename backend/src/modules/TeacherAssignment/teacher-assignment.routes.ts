import express from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import {
  getAssignments,
  getAllAssignments,
  saveAssignment,
  updateAssignment,
  deleteAssignment,
} from "./teacher-assignment.controller";

const router = express.Router();

router.use(tenantMiddleware, authMiddleware);

router.get("/", getAssignments);
router.get("/all", getAllAssignments);

router.post("/", saveAssignment);
router.put("/", updateAssignment);

// Delete via POST body (avoids DELETE-with-body compatibility issues)
router.post("/delete", deleteAssignment);

export default router;
