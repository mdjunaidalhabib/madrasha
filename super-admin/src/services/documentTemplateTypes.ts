import type { BackendDocumentType } from "@madrasha/shared-ui/src/components/DocumentDesigner/documentTypeMap";
import type { CanvasBackground, DocumentLayer } from "@madrasha/shared-ui/src/components/DocumentDesigner/types";

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
