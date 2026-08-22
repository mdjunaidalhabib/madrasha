import { Router } from "express";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { superAdminMiddleware } from "../../shared/middleware/superAdmin.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  deleteAdmissionApplication,
  deleteWebsiteCommitteeMember,
  deleteWebsiteGalleryItem,
  deleteWebsiteNotice,
  deleteWebsiteSlide,
  getPublicWebsite,
  getWebsiteSettings,
  saveWebsiteCommitteeMember,
  saveWebsiteGalleryItem,
  saveWebsiteNotice,
  saveWebsiteSlide,
  submitAdmissionApplication,
  submitFullAdmissionApplication,
  updateAdmissionApplicationStatus,
  upsertWebsitePage,
  upsertWebsiteSettings,
  updateWebsiteStatusBySuperAdmin,
} from "./website.controller";

const router = Router();

router.get("/public/:slug", getPublicWebsite);
router.post("/public/:slug/admission", submitAdmissionApplication);
router.post("/public/:slug/admission-full", submitFullAdmissionApplication);
const adminGuard = [tenantMiddleware, authMiddleware, rbacMiddleware("website.manage")];

router.get("/admin/settings", ...adminGuard, getWebsiteSettings);
router.put("/admin/settings", ...adminGuard, upsertWebsiteSettings);
router.put("/admin/pages", ...adminGuard, upsertWebsitePage);
router.post("/admin/notices", ...adminGuard, saveWebsiteNotice);
router.delete("/admin/notices/:id", ...adminGuard, deleteWebsiteNotice);
router.post("/admin/gallery", ...adminGuard, saveWebsiteGalleryItem);
router.delete("/admin/gallery/:id", ...adminGuard, deleteWebsiteGalleryItem);
router.post("/admin/slides", ...adminGuard, saveWebsiteSlide);
router.delete("/admin/slides/:id", ...adminGuard, deleteWebsiteSlide);
router.post("/admin/committee", ...adminGuard, saveWebsiteCommitteeMember);
router.delete("/admin/committee/:id", ...adminGuard, deleteWebsiteCommitteeMember);
router.patch("/admin/admissions/:id/status", ...adminGuard, updateAdmissionApplicationStatus);
router.delete("/admin/admissions/:id", ...adminGuard, deleteAdmissionApplication);
router.patch("/super/madrasas/:id/status", superAdminMiddleware, updateWebsiteStatusBySuperAdmin);

export default router;
