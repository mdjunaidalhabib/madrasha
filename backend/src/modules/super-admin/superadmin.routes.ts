import { Router } from "express";
import { superAdminMiddleware } from "../../shared/middleware/superAdmin.middleware";

/* =========================
   Madrasa handlers
========================= */
import {
  listMadrasas,
  createMadrasa,
  updateMadrasa,
  activateMadrasa,
  suspendMadrasa,
  trashMadrasa,
  listTrash,
  restoreMadrasa,
  permanentDeleteMadrasa,
  listPlans,
  assignPlanToMadrasa,
  getMadrasaDeleteStats,
  getSuperAdminStats,
} from "./superadmin.controller";

/* =========================
   Plans handlers (Trash system)
========================= */
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

/* =========================
   Meta handlers
========================= */
import { listDivisions, listClasses, listBooks, listModules } from "./meta.controller";

const router = Router();

/* =====================================================
   MADRASAS
===================================================== */

router.get("/madrasas", superAdminMiddleware, listMadrasas);
router.post("/madrasas", superAdminMiddleware, createMadrasa);
router.put("/madrasas/:id", superAdminMiddleware, updateMadrasa);
router.post("/madrasas/:id/activate", superAdminMiddleware, activateMadrasa);
router.post("/madrasas/:id/suspend", superAdminMiddleware, suspendMadrasa);
router.delete("/madrasas/:id", superAdminMiddleware, trashMadrasa);
router.get("/madrasas/trash", superAdminMiddleware, listTrash);
router.post("/madrasas/:id/restore", superAdminMiddleware, restoreMadrasa);

router.delete("/madrasas/:id/permanent", superAdminMiddleware, permanentDeleteMadrasa);

/* =====================================================
   MADRASA DELETE STATS
===================================================== */

router.get("/madrasas/:id/delete-stats", superAdminMiddleware, getMadrasaDeleteStats);

/* =====================================================
   ASSIGN PLAN TO MADRASA
===================================================== */

router.post("/madrasas/:id/assign-plan", superAdminMiddleware, assignPlanToMadrasa);

/* =====================================================
   PLANS (TRASH SYSTEM)
   Base: /api/super/plans
===================================================== */

// main list
router.get("/plans", superAdminMiddleware, listPlansAdmin);

// active plans only (dropdown safe)
router.get("/plans/active", superAdminMiddleware, listPlans);

// trash
router.get("/plans/trash", superAdminMiddleware, listTrashPlans);

// create
router.post("/plans", superAdminMiddleware, createPlanAdmin);

// update
router.put("/plans/:id", superAdminMiddleware, updatePlanAdmin);

// toggle active
router.patch("/plans/:id/toggle", superAdminMiddleware, togglePlanAdmin);

// delete -> move to trash
router.delete("/plans/:id", superAdminMiddleware, deletePlanAdmin);

// restore
router.post("/plans/:id/restore", superAdminMiddleware, restorePlanAdmin);

// permanent delete
router.delete("/plans/:id/permanent", superAdminMiddleware, permanentDeletePlanAdmin);

/* =====================================================
   SUPER ADMIN DASHBOARD
===================================================== */

router.get("/dashboard-stats", superAdminMiddleware, getSuperAdminStats);

/* =====================================================
   META CONFIG
   (Divisions + Modules)
===================================================== */

router.get("/divisions", superAdminMiddleware, listDivisions);
router.get("/classes", superAdminMiddleware, listClasses);
router.get("/books", superAdminMiddleware, listBooks);

router.get("/modules", superAdminMiddleware, listModules);

export default router;
