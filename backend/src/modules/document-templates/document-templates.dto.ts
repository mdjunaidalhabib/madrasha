import { CanvasBackgroundJson, DocumentLayerJson } from "./document-templates.types";

export interface CreateTemplateRequestDto {
  type: string;
  name: string;
  description?: string | null;
  /** If set, the new template is a deep clone of this one (must be
   * readable by the caller - own tenant template or a published system
   * template). Otherwise a blank starter is created. */
  source_template_id?: number;
}

export interface SaveDraftRequestDto {
  width?: number;
  height?: number;
  background?: CanvasBackgroundJson | null;
  layers?: DocumentLayerJson[];
}

export interface UpdateTemplateMetaRequestDto {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface SetTenantDefaultRequestDto {
  type: string;
  template_id: number;
}

export interface GenerateRequestDto {
  type: string;
  template_id?: number;
  class_id?: number;
  division_id?: number;
  student_ids?: number[];
}
