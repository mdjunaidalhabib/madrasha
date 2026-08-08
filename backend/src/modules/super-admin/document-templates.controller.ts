import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { BadRequestError } from "../../shared/errors";
import {
  documentTemplateService,
  assertDocumentType,
} from "../document-templates/document-templates.service";
import {
  toTemplateDetailDto,
  toTemplateListItemDto,
} from "../document-templates/document-templates.mapper";
import { TemplateActor } from "../document-templates/document-templates.types";
import { uploadPlatformBackground } from "./platform-cloudinary.util";

const SUPER_ADMIN_CONTEXT = { kind: "super_admin" as const };

const superAdminActor = (req: Request): TemplateActor => ({
  role: "SUPER_ADMIN",
  superAdminId: Number(req.user!.id),
});

export const listSystemTemplates = asyncHandler(async (req: Request, res: Response) => {
  const type = req.query.type ? assertDocumentType(req.query.type) : undefined;
  const rows = await documentTemplateService.listSystemTemplates(type);
  return ApiResponse.success(res, { data: rows.map(toTemplateListItemDto) });
});

export const getSystemTemplate = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.getDetail(Number(req.params.id), SUPER_ADMIN_CONTEXT);
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail) });
});

export const createSystemTemplate = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const detail = await documentTemplateService.createTemplate(SUPER_ADMIN_CONTEXT, superAdminActor(req), {
    type: body.type ? assertDocumentType(body.type) : undefined,
    name: body.name,
    description: body.description,
    sourceTemplateId: body.source_template_id ? Number(body.source_template_id) : undefined,
  });
  return ApiResponse.created(res, toTemplateDetailDto(detail), "System template created");
});

export const saveSystemDraft = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.saveDraft(
    Number(req.params.id),
    SUPER_ADMIN_CONTEXT,
    req.body || {},
  );
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail), message: "Draft saved" });
});

export const publishSystemTemplate = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.publish(
    Number(req.params.id),
    SUPER_ADMIN_CONTEXT,
    superAdminActor(req),
  );
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail), message: "Template published" });
});

export const updateSystemTemplateMeta = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const detail = await documentTemplateService.updateMeta(
    Number(req.params.id),
    SUPER_ADMIN_CONTEXT,
    superAdminActor(req),
    { name: body.name, description: body.description, isActive: body.is_active },
  );
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail), message: "Template updated" });
});

export const deleteSystemTemplate = asyncHandler(async (req: Request, res: Response) => {
  await documentTemplateService.deleteTemplate(Number(req.params.id), SUPER_ADMIN_CONTEXT, superAdminActor(req));
  return ApiResponse.success(res, { message: "Template deleted" });
});

export const setSystemDefaultTemplate = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.setSystemDefault(Number(req.params.id), Number(req.user!.id));
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail), message: "System default updated" });
});

export const uploadSystemTemplateBackground = asyncHandler(async (req: Request, res: Response) => {
  const image = req.body?.image;
  if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new BadRequestError("image must be a base64 data URI (data:image/...)");
  }

  const result = await uploadPlatformBackground(image);
  return ApiResponse.success(res, { data: result });
});
