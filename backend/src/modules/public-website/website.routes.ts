import { Router } from "express";
import { resolveAdminDomain } from "./admin-domain";
import { websiteService } from "./website.service";
import { normalizeHost } from "../../shared/utils/host.util";
import { BadRequestError } from "../../shared/errors";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { superAdminMiddleware } from "../../shared/middleware/superAdmin.middleware";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { websiteActivityMiddleware } from "./website-activity.middleware";
import {
  getDonationAccess, updateDonationAccess, getOwnDonationSettings, saveOwnDonationSettings, getOwnDonationDemo,
  deleteAdmissionApplication,
  deleteWebsiteCommitteeMember,
  deleteWebsiteGalleryItem,
  deleteWebsiteNotice,
  deleteWebsiteSlide,
  getPublicBrandIcon,
  getPublicWebsite,
  getWebsiteSettings,
  getDefaultWebsiteTemplate,
  updateDefaultWebsiteTemplate,
  uploadDefaultWebsiteImage,
  resolveDomain,
  deleteWebsiteVideo,
  saveWebsiteCommitteeMember,
  saveWebsiteGalleryItem,
  saveWebsiteNotice,
  saveWebsiteSlide,
  saveWebsiteVideo,
  submitAdmissionApplication,
  submitFullAdmissionApplication,
  updateAdmissionApplicationStatus,
  upsertWebsitePage,
  upsertWebsiteSettings,
  updateWebsiteStatusBySuperAdmin,
  getWebsiteThemeBySuperAdmin,
  updateWebsiteThemeBySuperAdmin,
  resetInstitutionWebsite,
  resetOwnInstitutionWebsite,
} from "./website.controller";

const router = Router();

router.get("/share", async (req, res, next) => {
  try {
    const host = normalizeHost(req.query.host);
    if (!host) throw new BadRequestError("Valid host required");
    const { slug } = await websiteService.resolveDomainToSlug(host);
    res.json({ data: await websiteService.getPublicShareMetadata(slug) });
  } catch (error) {
    next(error);
  }
});

// Small public response used by the frontend server before React runs.
router.get("/public/:slug/share", async (req, res, next) => {
  try {
    res.json({ data: await websiteService.getPublicShareMetadata(req.params.slug) });
  } catch (error) {
    next(error);
  }
});

// Registered before "/public/:slug" would be irrelevant anyway (different
// prefix), but kept as its own top-level path on purpose so a real madrasa
// slug can never collide with this literal route.
router.get("/resolve-domain", resolveDomain);
router.get("/resolve-admin-domain", resolveAdminDomain);
router.get("/public/:slug/brand", async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: await websiteService.getPublicBrand(req.params.slug) });
  } catch (error) {
    next(error);
  }
});
router.get("/public/:slug", getPublicWebsite);
router.get("/public/:slug/icon/:file", getPublicBrandIcon);
router.post("/public/:slug/admission", submitAdmissionApplication);
router.post("/public/:slug/admission-full", submitFullAdmissionApplication);
const adminGuard = [tenantMiddleware, authMiddleware, rbacMiddleware("website.manage"), websiteActivityMiddleware];

router.get("/admin/settings", ...adminGuard, getWebsiteSettings);
router.get("/admin/donations", ...adminGuard, getOwnDonationSettings);
router.get("/admin/donations/demo", ...adminGuard, getOwnDonationDemo);
router.put("/admin/donations", ...adminGuard, saveOwnDonationSettings);
router.get("/super/madrasas/:id/donations", superAdminMiddleware, getDonationAccess);
router.patch("/super/madrasas/:id/donations", superAdminMiddleware, updateDonationAccess);
router.put("/admin/settings", ...adminGuard, upsertWebsiteSettings);
router.post("/admin/reset", ...adminGuard, resetOwnInstitutionWebsite);
router.put("/admin/pages", ...adminGuard, upsertWebsitePage);
router.post("/admin/notices", ...adminGuard, saveWebsiteNotice);
router.delete("/admin/notices/:id", ...adminGuard, deleteWebsiteNotice);
router.post("/admin/gallery", ...adminGuard, saveWebsiteGalleryItem);
router.delete("/admin/gallery/:id", ...adminGuard, deleteWebsiteGalleryItem);
router.post("/admin/slides", ...adminGuard, saveWebsiteSlide);
router.delete("/admin/slides/:id", ...adminGuard, deleteWebsiteSlide);
router.post("/admin/videos", ...adminGuard, saveWebsiteVideo);
router.delete("/admin/videos/:id", ...adminGuard, deleteWebsiteVideo);
router.post("/admin/committee", ...adminGuard, saveWebsiteCommitteeMember);
router.delete("/admin/committee/:id", ...adminGuard, deleteWebsiteCommitteeMember);
router.patch("/admin/admissions/:id/status", ...adminGuard, updateAdmissionApplicationStatus);
router.delete("/admin/admissions/:id", ...adminGuard, deleteAdmissionApplication);
router.patch("/super/madrasas/:id/status", superAdminMiddleware, updateWebsiteStatusBySuperAdmin);
router.get("/super/madrasas/:id/theme", superAdminMiddleware, getWebsiteThemeBySuperAdmin);
router.patch("/super/madrasas/:id/theme", superAdminMiddleware, updateWebsiteThemeBySuperAdmin);
router.post("/super/madrasas/:id/reset", superAdminMiddleware, resetInstitutionWebsite);
router.get("/super/default-template", superAdminMiddleware, getDefaultWebsiteTemplate);
router.put("/super/default-template", superAdminMiddleware, updateDefaultWebsiteTemplate);
router.post("/super/default-template/image", superAdminMiddleware, uploadDefaultWebsiteImage);

export default router;
