import { DocumentTemplateScope, DocumentTemplateVersionStatus, DocumentType } from "@prisma/client";

/**
 * Structurally mirrors `DocumentLayer` in
 * frontend/src/components/DocumentDesigner/types.ts on purpose - the JSON
 * round-trips between browser and DB unchanged, so this shape must not
 * drift from the frontend one. Kept loose (not deep-validated per layer
 * type) so the designer can evolve rapidly without a backend release.
 */
export interface DocumentLayerJson {
  id: string;
  type: "text" | "image" | "photo" | "qrcode" | "barcode" | "logo" | "signature" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  style?: Record<string, unknown>;
  content?: Record<string, unknown>;
}

export interface CanvasBackgroundJson {
  image?: string;
  color?: string;
  fit?: "cover" | "contain" | "fill";
}

/** Who created/is acting on a template - discriminates the two
 * mutually-exclusive creator id columns on DocumentTemplate. */
export type TemplateActor =
  | { role: "TENANT_USER"; userId: number }
  | { role: "SUPER_ADMIN"; superAdminId: number };

export interface TemplateVersionSnapshot {
  id: number;
  versionNo: number;
  width: number;
  height: number;
  background: CanvasBackgroundJson | null;
  layers: DocumentLayerJson[];
  status: DocumentTemplateVersionStatus;
  publishedAt: Date | null;
}

export interface TemplateDetail {
  id: number;
  scope: DocumentTemplateScope;
  tenantId: number | null;
  type: DocumentType;
  name: string;
  description: string | null;
  clonedFromId: number | null;
  isPublished: boolean;
  isActive: boolean;
  isSystemDefault: boolean;
  isTenantDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  draft: TemplateVersionSnapshot | null;
  published: TemplateVersionSnapshot | null;
}

export interface TemplateListItem {
  id: number;
  scope: DocumentTemplateScope;
  tenantId: number | null;
  type: DocumentType;
  name: string;
  description: string | null;
  isPublished: boolean;
  isActive: boolean;
  isSystemDefault: boolean;
  isTenantDefault: boolean;
  thumbnail: { width: number; height: number; background: CanvasBackgroundJson | null } | null;
  updatedAt: Date;
}

export interface GenerateFilters {
  classId?: number;
  divisionId?: number;
  studentIds?: number[];
}
