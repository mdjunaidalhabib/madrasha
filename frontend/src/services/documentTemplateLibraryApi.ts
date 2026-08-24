import api, { cachedGet } from "./api";
import type { BackendDocumentType } from "../components/DocumentDesigner/documentTypeMap";
import type { CanvasBackground, DocumentLayer } from "../components/DocumentDesigner/types";

// NOTE: deliberately not named documentTemplateApi.ts — that file already
// exists for the unrelated legacy free-text template settings
// (sanad_template / testimonial_template / admit_card_rules / ...).

export interface TemplateVersionDto {
  id: number;
  version_no: number;
  width: number;
  height: number;
  background: CanvasBackground | null;
  layers: DocumentLayer[];
  status: "DRAFT" | "PUBLISHED";
  published_at: string | null;
}

export interface TemplateDetailDto {
  id: number;
  scope: "SYSTEM" | "TENANT";
  tenant_id: number | null;
  type: BackendDocumentType;
  name: string;
  description: string | null;
  cloned_from_id: number | null;
  is_published: boolean;
  is_active: boolean;
  is_system_default: boolean;
  is_tenant_default: boolean;
  created_at: string;
  updated_at: string;
  draft: TemplateVersionDto | null;
  published: TemplateVersionDto | null;
}

export interface TemplateListItemDto {
  id: number;
  scope: "SYSTEM" | "TENANT";
  tenant_id: number | null;
  type: BackendDocumentType;
  name: string;
  description: string | null;
  is_published: boolean;
  is_active: boolean;
  is_system_default: boolean;
  is_tenant_default: boolean;
  updated_at: string;
}

export interface TemplateVersionListItemDto {
  id: number;
  version_no: number;
  width: number;
  height: number;
  status: "DRAFT" | "PUBLISHED";
  published_at: string | null;
  created_at: string;
}

export interface GenerateResultDto {
  template: {
    id: number;
    name: string;
    width: number;
    height: number;
    background: CanvasBackground | null;
    layers: DocumentLayer[];
  };
  rows: Record<string, any>[];
}

export async function listTemplates(type: BackendDocumentType): Promise<TemplateListItemDto[]> {
  const res = await cachedGet("/document-templates", { params: { type } });
  return res.data?.data || [];
}

export async function getTemplate(id: number): Promise<TemplateDetailDto> {
  const res = await cachedGet(`/document-templates/${id}`);
  return res.data.data;
}

export async function createTemplate(payload: {
  type?: BackendDocumentType;
  name: string;
  description?: string | null;
  source_template_id?: number;
}): Promise<TemplateDetailDto> {
  const res = await api.post("/document-templates", payload);
  return res.data.data;
}

export async function cloneTemplate(
  id: number,
  payload: { name: string; description?: string | null },
): Promise<TemplateDetailDto> {
  const res = await api.post(`/document-templates/${id}/clone`, payload);
  return res.data.data;
}

export async function saveDraft(
  id: number,
  payload: { width?: number; height?: number; background?: CanvasBackground | null; layers?: DocumentLayer[] },
): Promise<TemplateDetailDto> {
  const res = await api.put(`/document-templates/${id}/draft`, payload);
  return res.data.data;
}

export async function publishTemplate(id: number): Promise<TemplateDetailDto> {
  const res = await api.post(`/document-templates/${id}/publish`);
  return res.data.data;
}

export async function updateTemplateMeta(
  id: number,
  payload: { name?: string; description?: string | null; is_active?: boolean },
): Promise<TemplateDetailDto> {
  const res = await api.put(`/document-templates/${id}`, payload);
  return res.data.data;
}

export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/document-templates/${id}`);
}

export async function getEffectiveDefault(type: BackendDocumentType): Promise<TemplateDetailDto> {
  // Default TTL caching is intentional here (not force-fresh): the print
  // pipeline mounts IdCardGrid/AdmitCardGrid twice in quick succession (an
  // off-screen pagination-measurement pass, then the visible render) and
  // relies on both resolving to the same cached response. Any mutation
  // (set default / publish / clone) already clears the whole GET cache via
  // the axios response interceptor, so this never serves stale data after
  // an edit.
  const res = await cachedGet(`/document-templates/default/${type}`);
  return res.data.data;
}

export async function setTenantDefault(type: BackendDocumentType, templateId: number): Promise<void> {
  await api.put("/document-templates/default", { type, template_id: templateId });
}

export async function getPreviewData(id: number): Promise<Record<string, any> | null> {
  const res = await cachedGet(`/document-templates/${id}/preview-data`);
  return res.data.data;
}

export async function listTemplateVersions(id: number): Promise<TemplateVersionListItemDto[]> {
  const res = await cachedGet(`/document-templates/${id}/versions`);
  return res.data?.data || [];
}

export async function restoreTemplateVersion(id: number, versionId: number): Promise<TemplateDetailDto> {
  const res = await api.post(`/document-templates/${id}/versions/${versionId}/restore`);
  return res.data.data;
}

export async function generateDocuments(payload: {
  type: BackendDocumentType;
  template_id?: number;
  class_id?: number;
  division_id?: number;
  student_ids?: number[];
}): Promise<GenerateResultDto> {
  const res = await api.post("/document-templates/generate", payload);
  return res.data.data;
}
