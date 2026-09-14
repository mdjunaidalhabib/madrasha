import { Router } from "express";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { listNotices, createNotice, updateNotice, deleteNotice } from "./notice.controller";

const router = Router();

router.use(tenantMiddleware, authMiddleware);

// Reuses the existing "document_templates" permission pair - notices are
// just another printable document type managed from the same Talimat
// settings area (see TalimatDocumentsPage/NoticeBoardPage on the frontend),
// so there's no need for a dedicated permission that would require its own
// seed/migration into the permissions table.
router.get("/", rbacMiddleware("document_templates.read"), listNotices);
router.post("/", rbacMiddleware("document_templates.manage"), createNotice);
router.put("/:id", rbacMiddleware("document_templates.manage"), updateNotice);
router.delete("/:id", rbacMiddleware("document_templates.manage"), deleteNotice);

export default router;
