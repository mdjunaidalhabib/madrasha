import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getClassRoutines,
  createClassRoutine,
  updateClassRoutine,
  deleteClassRoutine,
  getExamRoutines,
  createExamRoutine,
  updateExamRoutine,
  deleteExamRoutine,
} from "./routine.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// NOTE: MUHTAMIM/SUPER_ADMIN always bypass rbacMiddleware, and TALIMAT
// has a fallback covering routine.* (see rbac-policy.ts).

/* ================= CLASS ROUTINE ================= */
router.get("/class-routine", rbacMiddleware("routine.read"), getClassRoutines);
router.post("/class-routine", rbacMiddleware("routine.manage"), createClassRoutine);
router.put("/class-routine/:id", rbacMiddleware("routine.manage"), updateClassRoutine);
router.delete("/class-routine/:id", rbacMiddleware("routine.manage"), deleteClassRoutine);

/* ================= EXAM ROUTINE ================= */
router.get("/exam-routine", rbacMiddleware("routine.read"), getExamRoutines);
router.post("/exam-routine", rbacMiddleware("routine.manage"), createExamRoutine);
router.put("/exam-routine/:id", rbacMiddleware("routine.manage"), updateExamRoutine);
router.delete("/exam-routine/:id", rbacMiddleware("routine.manage"), deleteExamRoutine);

export default router;
