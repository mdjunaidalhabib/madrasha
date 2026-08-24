import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { subscriptionCheck } from "../../shared/middleware/subscription.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { validate } from "../../shared/middleware/validate.middleware";
import {
  documentTemplateIdParamSchema,
  documentTemplateVersionRestoreParamSchema,
} from "./document-templates.validation";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  cloneTemplate,
  saveDraft,
  publishTemplate,
  updateTemplateMeta,
  deleteTemplate,
  getEffectiveDefault,
  setTenantDefault,
  getPreviewData,
  generateDocuments,
  listTemplateVersions,
  restoreTemplateVersion,
} from "./document-templates.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware, subscriptionCheck);

const canRead = rbacMiddleware("document_templates.read");
const canManage = rbacMiddleware("document_templates.manage");

// NOTE: "/default/:type" (2 segments) and "/generate" (1 segment, no id)
// never collide with "/:id" (1 segment) regardless of order, but "/default"
// (PUT, 1 segment) MUST be registered before "PUT /:id" below or Express
// would parse "default" as an :id.

router.get("/", canRead, listTemplates);
router.get("/default/:type", canRead, getEffectiveDefault);
router.put("/default", canManage, setTenantDefault);
router.post("/generate", canManage, generateDocuments);

router.post("/", canManage, createTemplate);
router.post("/:id/clone", canManage, validate(documentTemplateIdParamSchema), cloneTemplate);
router.put("/:id/draft", canManage, validate(documentTemplateIdParamSchema), saveDraft);
router.post("/:id/publish", canManage, validate(documentTemplateIdParamSchema), publishTemplate);
router.get("/:id/preview-data", canRead, validate(documentTemplateIdParamSchema), getPreviewData);
router.get("/:id/versions", canRead, validate(documentTemplateIdParamSchema), listTemplateVersions);
router.post(
  "/:id/versions/:versionId/restore",
  canManage,
  validate(documentTemplateVersionRestoreParamSchema),
  restoreTemplateVersion,
);
router.put("/:id", canManage, validate(documentTemplateIdParamSchema), updateTemplateMeta);
router.delete("/:id", canManage, validate(documentTemplateIdParamSchema), deleteTemplate);
router.get("/:id", canRead, validate(documentTemplateIdParamSchema), getTemplate);

export default router;
