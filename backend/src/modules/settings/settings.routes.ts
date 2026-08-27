import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import {
  getDivisions,
  getClassesByDivision,
  getBranding,
  updateBranding,
  deleteBrandingImage,
  getDocumentTemplates,
  updateDocumentTemplates,
  getIdCardDesign,
  updateIdCardDesign,
  getAdmitCardDesign,
  updateAdmitCardDesign,
  getLetterDesign,
  updateLetterDesign,
  getBookLabelDesign,
  updateBookLabelDesign,
  getMyPlan,
  getSectionToggles,
  updateSectionToggle,
} from "./settings.controller";

const router = Router();

router.get("/divisions", tenantMiddleware, authMiddleware, subscriptionCheck, getDivisions);
router.get("/classes/:division_id", tenantMiddleware, authMiddleware, subscriptionCheck, getClassesByDivision);

router.get("/branding", tenantMiddleware, authMiddleware, getBranding);
router.put(
  "/branding",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("settings.manage"),
  updateBranding,
);
router.delete(
  "/branding/:field",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("settings.manage"),
  deleteBrandingImage,
);

router.get("/document-templates", tenantMiddleware, authMiddleware, getDocumentTemplates);
router.put(
  "/document-templates",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("settings.manage"),
  updateDocumentTemplates,
);

router.get("/id-card-design", tenantMiddleware, authMiddleware, getIdCardDesign);
router.put(
  "/id-card-design",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("settings.manage"),
  updateIdCardDesign,
);

router.get("/admit-card-design", tenantMiddleware, authMiddleware, getAdmitCardDesign);
router.put(
  "/admit-card-design",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("settings.manage"),
  updateAdmitCardDesign,
);

router.get("/letter-design", tenantMiddleware, authMiddleware, getLetterDesign);
router.put(
  "/letter-design",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("settings.manage"),
  updateLetterDesign,
);

router.get("/book-label-design", tenantMiddleware, authMiddleware, getBookLabelDesign);
router.put(
  "/book-label-design",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("settings.manage"),
  updateBookLabelDesign,
);

router.get("/plan", tenantMiddleware, authMiddleware, getMyPlan);

router.get("/section-toggles", tenantMiddleware, authMiddleware, getSectionToggles);
router.put(
  "/section-toggles",
  tenantMiddleware,
  authMiddleware,
  rbacMiddleware("settings.manage"),
  updateSectionToggle,
);

export default router;
