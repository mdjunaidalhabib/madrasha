import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import {
  getDivisions,
  getClassesByDivision,
  getBranding,
  updateBranding,
  deleteBrandingImage,
  getDocumentTemplates,
  updateDocumentTemplates,
} from "./settings.controller";

const router = Router();

router.get("/divisions", tenantMiddleware, authMiddleware, subscriptionCheck, getDivisions);
router.get("/classes/:division_id", tenantMiddleware, authMiddleware, subscriptionCheck, getClassesByDivision);

router.get("/branding", tenantMiddleware, authMiddleware, getBranding);
router.put("/branding", tenantMiddleware, authMiddleware, updateBranding);
router.delete("/branding/:field", tenantMiddleware, authMiddleware, deleteBrandingImage);

router.get("/document-templates", tenantMiddleware, authMiddleware, getDocumentTemplates);
router.put("/document-templates", tenantMiddleware, authMiddleware, updateDocumentTemplates);

export default router;
