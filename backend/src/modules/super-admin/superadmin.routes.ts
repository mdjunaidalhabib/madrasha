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
  getSuperAdminDashboardTrends,
  getMadrasaDetail,
  listMadrasaRoles,
  listMadrasaUsers,
  createMadrasaUser,
  deleteMadrasaUser,
  updateMadrasaUserCredentials,
  updateMadrasaUserRoleStatus,
} from "./superadmin.controller";

/* =========================
   Madrasa role/permission handlers (mirror of the tenant Roles &
   Permissions page, operable from the super-admin panel)
========================= */
import {
  listMadrasaPermissionCatalog,
  listMadrasaRolePermissions,
  createMadrasaRole,
  updateMadrasaRole,
  deleteMadrasaRole,
} from "./superadmin-role.controller";

/* =========================
   Madrasa data clean (full/operational wipe with password re-verify)
========================= */
import { getMadrasaCleanStats, cleanMadrasaData } from "./madrasa-clean.controller";

/* =========================
   Super admin account handlers (manage other super-admin logins)
========================= */
import {
  listSuperAdmins,
  createSuperAdmin,
  deactivateSuperAdmin,
  reactivateSuperAdmin,
} from "./superadmin-account.controller";

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
import {
  listDivisions,
  createDivision,
  updateDivision,
  deleteDivision,
  reorderDivisions,
  listClasses,
  createClass,
  updateClass,
  toggleClassActive,
  deleteClass,
  reorderClasses,
  listBooks,
  createBook,
  updateBook,
  deleteBook,
  reorderBooks,
  listModules,
} from "./meta.controller";

/* =========================
   Default fee structure template handlers
========================= */
import {
  listDefaultFeeStructures,
  createDefaultFeeStructure,
  updateDefaultFeeStructure,
  deleteDefaultFeeStructure,
} from "./default-fee-structure.controller";

/* =========================
   Important links handlers
========================= */
import {
  listImportantLinks,
  createImportantLink,
  updateImportantLink,
  deleteImportantLink,
  reorderImportantLinks,
} from "./important-link.controller";

/* =========================
   Vendor promo handlers (Dashboard "Hikmah IT" card + detail page)
========================= */
import {
  getVendorPromoConfig,
  saveVendorPromoConfig,
  listVendorServices,
  createVendorService,
  updateVendorService,
  deleteVendorService,
  reorderVendorServices,
} from "./vendor-promo.controller";

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
  getPlatformSmsConfig,
  savePlatformSmsConfig,
  deletePlatformSmsConfig,
  checkPlatformSmsBalance,
  getPlatformEmailConfig,
  savePlatformEmailConfig,
  deletePlatformEmailConfig,
  checkPlatformEmailConnection,
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
   MADRASA DATA CLEAN (super-admin-only, password-verified wipe)
===================================================== */

router.get("/madrasas/:id/clean-stats", superAdminMiddleware, getMadrasaCleanStats);
router.post("/madrasas/:id/clean", superAdminMiddleware, cleanMadrasaData);

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
router.patch("/madrasas/:id/users/:userId/credentials", superAdminMiddleware, updateMadrasaUserCredentials);
router.patch("/madrasas/:id/users/:userId/role-status", superAdminMiddleware, updateMadrasaUserRoleStatus);

/* =====================================================
   MADRASA ROLES & PERMISSIONS (full control mirror of the tenant page)
   Base: /api/super/madrasas/:id
===================================================== */

router.get("/madrasas/:id/permission-catalog", superAdminMiddleware, listMadrasaPermissionCatalog);
router.get("/madrasas/:id/role-permissions", superAdminMiddleware, listMadrasaRolePermissions);
router.post("/madrasas/:id/role-permissions", superAdminMiddleware, createMadrasaRole);
router.put("/madrasas/:id/role-permissions/:roleId", superAdminMiddleware, updateMadrasaRole);
router.delete("/madrasas/:id/role-permissions/:roleId", superAdminMiddleware, deleteMadrasaRole);

/* =====================================================
   SUPER ADMIN ACCOUNTS (manage other super-admin logins)
   Base: /api/super/admins
===================================================== */

router.get("/admins", superAdminMiddleware, listSuperAdmins);
router.post("/admins", superAdminMiddleware, createSuperAdmin);
router.patch("/admins/:id/deactivate", superAdminMiddleware, deactivateSuperAdmin);
router.patch("/admins/:id/reactivate", superAdminMiddleware, reactivateSuperAdmin);

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
router.get("/dashboard-trends", superAdminMiddleware, getSuperAdminDashboardTrends);

/* =====================================================
   META CONFIG
   (Divisions + Modules)
===================================================== */

router.get("/divisions", superAdminMiddleware, listDivisions);
router.post("/divisions", superAdminMiddleware, createDivision);
// NOTE: kept before "/divisions/:id" so "reorder" doesn't get matched as :id
router.put("/divisions/reorder", superAdminMiddleware, reorderDivisions);
router.put("/divisions/:id", superAdminMiddleware, updateDivision);
router.delete("/divisions/:id", superAdminMiddleware, deleteDivision);

router.get("/classes", superAdminMiddleware, listClasses);
router.post("/classes", superAdminMiddleware, createClass);
router.put("/classes/reorder", superAdminMiddleware, reorderClasses);
router.put("/classes/:id", superAdminMiddleware, updateClass);
router.patch("/classes/:id/toggle", superAdminMiddleware, toggleClassActive);
router.delete("/classes/:id", superAdminMiddleware, deleteClass);

router.get("/books", superAdminMiddleware, listBooks);
router.post("/books", superAdminMiddleware, createBook);
router.put("/books/reorder", superAdminMiddleware, reorderBooks);
router.put("/books/:id", superAdminMiddleware, updateBook);
router.delete("/books/:id", superAdminMiddleware, deleteBook);

router.get("/modules", superAdminMiddleware, listModules);

/* =====================================================
   DEFAULT FEE STRUCTURE TEMPLATES
   Base: /api/super/default-fee-structures
===================================================== */

router.get("/default-fee-structures", superAdminMiddleware, listDefaultFeeStructures);
router.post("/default-fee-structures", superAdminMiddleware, createDefaultFeeStructure);
router.put("/default-fee-structures/:id", superAdminMiddleware, updateDefaultFeeStructure);
router.delete("/default-fee-structures/:id", superAdminMiddleware, deleteDefaultFeeStructure);

/* =====================================================
   IMPORTANT LINKS (shown on every tenant's Dashboard)
   Base: /api/super/important-links
===================================================== */

router.get("/important-links", superAdminMiddleware, listImportantLinks);
router.post("/important-links", superAdminMiddleware, createImportantLink);
router.put("/important-links/reorder", superAdminMiddleware, reorderImportantLinks);
router.put("/important-links/:id", superAdminMiddleware, updateImportantLink);
router.delete("/important-links/:id", superAdminMiddleware, deleteImportantLink);

/* =====================================================
   Base: /api/super/vendor-promo
===================================================== */
router.get("/vendor-promo", superAdminMiddleware, getVendorPromoConfig);
router.put("/vendor-promo", superAdminMiddleware, saveVendorPromoConfig);
router.get("/vendor-promo/services", superAdminMiddleware, listVendorServices);
router.post("/vendor-promo/services", superAdminMiddleware, createVendorService);
router.put("/vendor-promo/services/reorder", superAdminMiddleware, reorderVendorServices);
router.put("/vendor-promo/services/:id", superAdminMiddleware, updateVendorService);
router.delete("/vendor-promo/services/:id", superAdminMiddleware, deleteVendorService);

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

router.get("/platform-settings/sms", superAdminMiddleware, getPlatformSmsConfig);
router.put("/platform-settings/sms", superAdminMiddleware, savePlatformSmsConfig);
router.delete("/platform-settings/sms", superAdminMiddleware, deletePlatformSmsConfig);
router.get("/platform-settings/sms/balance", superAdminMiddleware, checkPlatformSmsBalance);

router.get("/platform-settings/email", superAdminMiddleware, getPlatformEmailConfig);
router.put("/platform-settings/email", superAdminMiddleware, savePlatformEmailConfig);
router.delete("/platform-settings/email", superAdminMiddleware, deletePlatformEmailConfig);
router.get("/platform-settings/email/test", superAdminMiddleware, checkPlatformEmailConnection);

export default router;
