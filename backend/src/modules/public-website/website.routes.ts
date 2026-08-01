import { Router } from "express";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { superAdminMiddleware } from "../../shared/middleware/superAdmin.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
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
router.get("/admin/settings", tenantMiddleware, authMiddleware, getWebsiteSettings);
router.put("/admin/settings", tenantMiddleware, authMiddleware, upsertWebsiteSettings);
router.put("/admin/pages", tenantMiddleware, authMiddleware, upsertWebsitePage);
router.post("/admin/notices", tenantMiddleware, authMiddleware, saveWebsiteNotice);
router.delete("/admin/notices/:id", tenantMiddleware, authMiddleware, deleteWebsiteNotice);
router.post("/admin/gallery", tenantMiddleware, authMiddleware, saveWebsiteGalleryItem);
router.delete("/admin/gallery/:id", tenantMiddleware, authMiddleware, deleteWebsiteGalleryItem);
router.post("/admin/slides", tenantMiddleware, authMiddleware, saveWebsiteSlide);
router.delete("/admin/slides/:id", tenantMiddleware, authMiddleware, deleteWebsiteSlide);
router.post("/admin/committee", tenantMiddleware, authMiddleware, saveWebsiteCommitteeMember);
router.delete("/admin/committee/:id", tenantMiddleware, authMiddleware, deleteWebsiteCommitteeMember);
router.patch("/admin/admissions/:id/status", tenantMiddleware, authMiddleware, updateAdmissionApplicationStatus);
router.delete("/admin/admissions/:id", tenantMiddleware, authMiddleware, deleteAdmissionApplication);
router.patch("/super/madrasas/:id/status", superAdminMiddleware, updateWebsiteStatusBySuperAdmin);

export default router;
