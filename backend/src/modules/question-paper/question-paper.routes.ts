import { Router } from "express";
import { z } from "zod";
import { tenantMiddleware } from "../../shared/middleware/tenant.middleware";
import { authMiddleware } from "../../shared/middleware/auth.middleware";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { questionPaperService as service } from "./question-paper.service";

const router = Router();
router.use(tenantMiddleware, authMiddleware, rbacMiddleware("talimat.manage"));
router.get(
  "/references",
  asyncHandler(async (req, res) => {
    res.json({ data: await service.references(req.tenant!.madrasa_id) });
  }),
);
router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await service.list(req.tenant!.madrasa_id) });
  }),
);
router.post(
  "/",
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json({ data: await service.create(req.tenant!.madrasa_id, req.user!.id, req.body) });
  }),
);
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({
      data: await service.update(
        req.tenant!.madrasa_id,
        z.string().uuid().parse(req.params.id),
        req.body,
      ),
    });
  }),
);
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await service.remove(req.tenant!.madrasa_id, z.string().uuid().parse(req.params.id));
    res.json({ success: true });
  }),
);
export default router;
