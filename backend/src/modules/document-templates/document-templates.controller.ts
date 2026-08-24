import { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { ApiResponse } from "../../shared/responses";
import { BadRequestError } from "../../shared/errors";
import { documentTemplateService, assertDocumentType } from "./document-templates.service";
import { legacyTemplateMigrationService } from "./legacy-template-migration.service";
import {
  toTemplateDetailDto,
  toTemplateListItemDto,
  toTemplateVersionListItemDto,
} from "./document-templates.mapper";
import { TemplateActor } from "./document-templates.types";

const tenantContext = (req: Request): { kind: "tenant"; tenantId: number } => ({
  kind: "tenant",
  tenantId: req.tenant!.madrasa_id,
});

const tenantActor = (req: Request): TemplateActor => ({
  role: "TENANT_USER",
  userId: req.user!.id,
});

const ensureMigrated = (madrasaId: number, type: any) =>
  legacyTemplateMigrationService.ensureMigrated(madrasaId, type);

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const type = assertDocumentType(req.query.type);
  const rows = await documentTemplateService.listForTenant(tenantContext(req).tenantId, type);
  return ApiResponse.success(res, { data: rows.map(toTemplateListItemDto) });
});

export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.getDetail(Number(req.params.id), tenantContext(req));
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail) });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const detail = await documentTemplateService.createTemplate(tenantContext(req), tenantActor(req), {
    type: body.type ? assertDocumentType(body.type) : undefined,
    name: body.name,
    description: body.description,
    sourceTemplateId: body.source_template_id ? Number(body.source_template_id) : undefined,
  });
  return ApiResponse.created(res, toTemplateDetailDto(detail), "Template created");
});

export const cloneTemplate = asyncHandler(async (req: Request, res: Response) => {
  const sourceId = Number(req.params.id);
  const body = req.body || {};
  if (!body.name) throw new BadRequestError("name is required");
  const detail = await documentTemplateService.createTemplate(tenantContext(req), tenantActor(req), {
    name: body.name,
    description: body.description,
    sourceTemplateId: sourceId,
  });
  return ApiResponse.created(res, toTemplateDetailDto(detail), "Template cloned");
});

export const saveDraft = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.saveDraft(Number(req.params.id), tenantContext(req), req.body || {});
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail), message: "Draft saved" });
});

export const publishTemplate = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.publish(Number(req.params.id), tenantContext(req), tenantActor(req));
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail), message: "Template published" });
});

export const updateTemplateMeta = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const detail = await documentTemplateService.updateMeta(Number(req.params.id), tenantContext(req), tenantActor(req), {
    name: body.name,
    description: body.description,
    isActive: body.is_active,
  });
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail), message: "Template updated" });
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  await documentTemplateService.deleteTemplate(Number(req.params.id), tenantContext(req), tenantActor(req));
  return ApiResponse.success(res, { message: "Template deleted" });
});

export const getEffectiveDefault = asyncHandler(async (req: Request, res: Response) => {
  const type = assertDocumentType(req.params.type);
  const detail = await documentTemplateService.getEffectiveDefault(
    tenantContext(req).tenantId,
    type,
    ensureMigrated,
  );
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail) });
});

export const setTenantDefault = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const type = assertDocumentType(body.type);
  const templateId = Number(body.template_id);
  if (!templateId) throw new BadRequestError("template_id is required");

  await documentTemplateService.setTenantDefault(tenantContext(req).tenantId, type, templateId, tenantActor(req));
  return ApiResponse.success(res, { message: "Tenant default updated" });
});

export const getPreviewData = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.getDetail(Number(req.params.id), tenantContext(req));
  const row = await documentTemplateService.getPreviewRow(tenantContext(req).tenantId, detail.type);
  return ApiResponse.success(res, { data: row });
});

export const listTemplateVersions = asyncHandler(async (req: Request, res: Response) => {
  const versions = await documentTemplateService.listVersions(Number(req.params.id), tenantContext(req));
  return ApiResponse.success(res, { data: versions.map(toTemplateVersionListItemDto) });
});

export const restoreTemplateVersion = asyncHandler(async (req: Request, res: Response) => {
  const detail = await documentTemplateService.restoreVersion(
    Number(req.params.id),
    Number(req.params.versionId),
    tenantContext(req),
    tenantActor(req),
  );
  return ApiResponse.success(res, { data: toTemplateDetailDto(detail), message: "Version restored to draft" });
});

export const generateDocuments = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const type = assertDocumentType(body.type);

  const result = await documentTemplateService.generate(
    tenantContext(req).tenantId,
    type,
    body.template_id ? Number(body.template_id) : undefined,
    {
      classId: body.class_id ? Number(body.class_id) : undefined,
      divisionId: body.division_id ? Number(body.division_id) : undefined,
      studentIds: Array.isArray(body.student_ids) ? body.student_ids.map(Number) : undefined,
    },
    ensureMigrated,
  );

  return ApiResponse.success(res, { data: result });
});
