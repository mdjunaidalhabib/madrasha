import api, { cachedGet } from "./adminApi";
import type { BackendDocumentType } from "../components/DocumentDesigner/documentTypeMap";
import type { TemplateDetailDto, TemplateListItemDto } from "./documentTemplateLibraryApi";
import type { CanvasBackground, DocumentLayer } from "../components/DocumentDesigner/types";

// Dedicated file (not folded into superAdminApi.ts) - this feature's route
// count (list/create/draft/publish/set-default/delete/upload) would roughly
// double that file; matches how large tenant-side modules (students) get
// their own service file too.

export async function listSystemTemplates(type?: BackendDocumentType): Promise<TemplateListItemDto[]> {
  const res = await cachedGet("/super/document-templates", { params: type ? { type } : undefined });
  return res.data?.data || [];
}

export async function getSystemTemplate(id: number): Promise<TemplateDetailDto> {
  const res = await cachedGet(`/super/document-templates/${id}`);
  return res.data.data;
}

export async function createSystemTemplate(payload: {
  type?: BackendDocumentType;
  name: string;
  description?: string | null;
  source_template_id?: number;
}): Promise<TemplateDetailDto> {
  const res = await api.post("/super/document-templates", payload);
  return res.data.data;
}

export async function saveSystemDraft(
  id: number,
  payload: { width?: number; height?: number; background?: CanvasBackground | null; layers?: DocumentLayer[] },
): Promise<TemplateDetailDto> {
  const res = await api.put(`/super/document-templates/${id}/draft`, payload);
  return res.data.data;
}

export async function publishSystemTemplate(id: number): Promise<TemplateDetailDto> {
  const res = await api.post(`/super/document-templates/${id}/publish`);
  return res.data.data;
}

export async function updateSystemTemplateMeta(
  id: number,
  payload: { name?: string; description?: string | null; is_active?: boolean },
): Promise<TemplateDetailDto> {
  const res = await api.put(`/super/document-templates/${id}`, payload);
  return res.data.data;
}

export async function deleteSystemTemplate(id: number): Promise<void> {
  await api.delete(`/super/document-templates/${id}`);
}

export async function setSystemDefaultTemplate(id: number): Promise<TemplateDetailDto> {
  const res = await api.post(`/super/document-templates/${id}/set-system-default`);
  return res.data.data;
}

export async function uploadSystemTemplateBackground(imageDataUri: string): Promise<{ url: string; public_id: string }> {
  const res = await api.post("/super/document-templates/upload-background", { image: imageDataUri });
  return res.data.data;
}
