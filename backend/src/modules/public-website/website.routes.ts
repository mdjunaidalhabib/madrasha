import { Router } from "express";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { superAdminMiddleware } from "../../shared/middleware/superAdmin.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import {
  deleteWebsiteGalleryItem,
  deleteWebsiteNotice,
  getPublicWebsite,
  getWebsiteSettings,
  saveWebsiteGalleryItem,
  saveWebsiteNotice,
  upsertWebsitePage,
  upsertWebsiteSettings,
  updateWebsiteStatusBySuperAdmin,
} from "./website.controller";

const router = Router();

router.get("/public/:slug", getPublicWebsite);
router.get("/admin/settings", tenantMiddleware, authMiddleware, getWebsiteSettings);
router.put("/admin/settings", tenantMiddleware, authMiddleware, upsertWebsiteSettings);
router.put("/admin/pages", tenantMiddleware, authMiddleware, upsertWebsitePage);
router.post("/admin/notices", tenantMiddleware, authMiddleware, saveWebsiteNotice);
router.delete("/admin/notices/:id", tenantMiddleware, authMiddleware, deleteWebsiteNotice);
router.post("/admin/gallery", tenantMiddleware, authMiddleware, saveWebsiteGalleryItem);
router.delete("/admin/gallery/:id", tenantMiddleware, authMiddleware, deleteWebsiteGalleryItem);
router.patch("/super/madrasas/:id/status", superAdminMiddleware, updateWebsiteStatusBySuperAdmin);

export default router;
