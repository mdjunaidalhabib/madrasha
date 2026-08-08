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
  getMadrasaDetail,
  listMadrasaRoles,
  listMadrasaUsers,
  createMadrasaUser,
  deleteMadrasaUser,
  getMadrasaCloudinaryConfig,
  saveMadrasaCloudinaryConfig,
  deleteMadrasaCloudinaryConfig,
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

/* =========================
   Document template handlers
========================= */
import {
  listSystemTemplates,
  getSystemTemplate,
  createSystemTemplate,
  saveSystemDraft,
  publishSystemTemplate,
  updateSystemTemplateMeta,
  deleteSystemTemplate,
  setSystemDefaultTemplate,
  uploadSystemTemplateBackground,
} from "./document-templates.controller";

/* =========================
   Platform settings handlers
========================= */
import {
  getPlatformCloudinaryConfig,
  savePlatformCloudinaryConfig,
  deletePlatformCloudinaryConfig,
} from "./platform-settings.controller";

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

// NOTE: kept after "/madrasas/trash" so "trash" doesn't get matched as :id
router.get("/madrasas/:id", superAdminMiddleware, getMadrasaDetail);

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
   MADRASA USERS (Super Admin setup)
===================================================== */

router.get("/madrasas/:id/roles", superAdminMiddleware, listMadrasaRoles);
router.get("/madrasas/:id/users", superAdminMiddleware, listMadrasaUsers);
router.post("/madrasas/:id/users", superAdminMiddleware, createMadrasaUser);
router.delete("/madrasas/:id/users/:userId", superAdminMiddleware, deleteMadrasaUser);

/* =====================================================
   MADRASA CLOUDINARY CONFIG (per-tenant storage account)
===================================================== */

router.get("/madrasas/:id/cloudinary", superAdminMiddleware, getMadrasaCloudinaryConfig);
router.put("/madrasas/:id/cloudinary", superAdminMiddleware, saveMadrasaCloudinaryConfig);
router.delete("/madrasas/:id/cloudinary", superAdminMiddleware, deleteMadrasaCloudinaryConfig);

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

/* =====================================================
   DOCUMENT TEMPLATES (System Template Library)
   Base: /api/super/document-templates
===================================================== */

router.get("/document-templates", superAdminMiddleware, listSystemTemplates);
router.post("/document-templates", superAdminMiddleware, createSystemTemplate);
router.post("/document-templates/upload-background", superAdminMiddleware, uploadSystemTemplateBackground);
router.put("/document-templates/:id/draft", superAdminMiddleware, saveSystemDraft);
router.post("/document-templates/:id/publish", superAdminMiddleware, publishSystemTemplate);
router.post("/document-templates/:id/set-system-default", superAdminMiddleware, setSystemDefaultTemplate);
router.put("/document-templates/:id", superAdminMiddleware, updateSystemTemplateMeta);
router.delete("/document-templates/:id", superAdminMiddleware, deleteSystemTemplate);
router.get("/document-templates/:id", superAdminMiddleware, getSystemTemplate);

/* =====================================================
   PLATFORM SETTINGS (Super Admin's own account-level config)
   Base: /api/super/platform-settings
===================================================== */

router.get("/platform-settings/cloudinary", superAdminMiddleware, getPlatformCloudinaryConfig);
router.put("/platform-settings/cloudinary", superAdminMiddleware, savePlatformCloudinaryConfig);
router.delete("/platform-settings/cloudinary", superAdminMiddleware, deletePlatformCloudinaryConfig);

export default router;
