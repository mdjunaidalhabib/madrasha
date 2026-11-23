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
  "/instruction-templates",
  asyncHandler(async (req, res) => {
    res.json({ data: await service.listClosingTemplates(req.tenant!.madrasa_id, "instruction") });
  }),
);
router.post(
  "/instruction-templates",
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json({
        data: await service.createClosingTemplate(req.tenant!.madrasa_id, req.body, "instruction"),
      });
  }),
);
router.put(
  "/instruction-templates/:id",
  asyncHandler(async (req, res) => {
    res.json({
      data: await service.updateClosingTemplate(
        req.tenant!.madrasa_id,
        z.string().uuid().parse(req.params.id),
        req.body,
        "instruction",
      ),
    });
  }),
);
router.delete(
  "/instruction-templates/:id",
  asyncHandler(async (req, res) => {
    await service.removeClosingTemplate(
      req.tenant!.madrasa_id,
      z.string().uuid().parse(req.params.id),
      "instruction",
    );
    res.json({ success: true });
  }),
);
router.get(
  "/closing-templates",
  asyncHandler(async (req, res) => {
    res.json({ data: await service.listClosingTemplates(req.tenant!.madrasa_id) });
  }),
);
router.post(
  "/closing-templates",
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json({ data: await service.createClosingTemplate(req.tenant!.madrasa_id, req.body) });
  }),
);
router.get(
  "/references",
  asyncHandler(async (req, res) => {
    res.json({ data: await service.references(req.tenant!.madrasa_id) });
  }),
);
router.put(
  "/closing-templates/:id",
  asyncHandler(async (req, res) => {
    res.json({
      data: await service.updateClosingTemplate(
        req.tenant!.madrasa_id,
        z.string().uuid().parse(req.params.id),
        req.body,
      ),
    });
  }),
);
router.delete(
  "/closing-templates/:id",
  asyncHandler(async (req, res) => {
    await service.removeClosingTemplate(
      req.tenant!.madrasa_id,
      z.string().uuid().parse(req.params.id),
    );
    res.json({ success: true });
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
