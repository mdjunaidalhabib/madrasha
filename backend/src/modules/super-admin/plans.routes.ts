import { Router } from "express";
import { superAdminMiddleware } from "../../shared/middleware/superAdmin.middleware";

import {
  listPlansAdmin,
  listTrashPlans,
  createPlanAdmin,
  updatePlanAdmin,
  togglePlanAdmin,
  deletePlanAdmin,
  restorePlanAdmin,
  permanentDeletePlanAdmin,
} from "./plans.controller";

const router = Router();

/* =====================================================
   PLANS LIST
   GET /api/super/plans
===================================================== */

router.get("/plans", superAdminMiddleware, listPlansAdmin);

/* =====================================================
   TRASH LIST
   GET /api/super/plans/trash
===================================================== */

router.get("/plans/trash", superAdminMiddleware, listTrashPlans);

/* =====================================================
   CREATE PLAN
   POST /api/super/plans
===================================================== */

router.post("/plans", superAdminMiddleware, createPlanAdmin);

/* =====================================================
   UPDATE PLAN
   PUT /api/super/plans/:id
===================================================== */

router.put("/plans/:id", superAdminMiddleware, updatePlanAdmin);

/* =====================================================
   TOGGLE ACTIVE
   PATCH /api/super/plans/:id/toggle
===================================================== */

router.patch("/plans/:id/toggle", superAdminMiddleware, togglePlanAdmin);

/* =====================================================
   MOVE TO TRASH
   DELETE /api/super/plans/:id
===================================================== */

router.delete("/plans/:id", superAdminMiddleware, deletePlanAdmin);

/* =====================================================
   RESTORE FROM TRASH
   POST /api/super/plans/:id/restore
===================================================== */

router.post("/plans/:id/restore", superAdminMiddleware, restorePlanAdmin);

/* =====================================================
   PERMANENT DELETE
   DELETE /api/super/plans/:id/permanent
===================================================== */

router.delete("/plans/:id/permanent", superAdminMiddleware, permanentDeletePlanAdmin);

export default router;
