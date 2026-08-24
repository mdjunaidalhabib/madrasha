import {
  TemplateDetail,
  TemplateListItem,
  TemplateVersionListItem,
  TemplateVersionSnapshot,
} from "./document-templates.types";

const toVersionDto = (version: TemplateVersionSnapshot | null) =>
  version && {
    id: version.id,
    version_no: version.versionNo,
    width: version.width,
    height: version.height,
    background: version.background,
    layers: version.layers,
    status: version.status,
    published_at: version.publishedAt,
  };

export const toTemplateDetailDto = (row: TemplateDetail) => ({
  id: row.id,
  scope: row.scope,
  tenant_id: row.tenantId,
  type: row.type,
  name: row.name,
  description: row.description,
  cloned_from_id: row.clonedFromId,
  is_published: row.isPublished,
  is_active: row.isActive,
  is_system_default: row.isSystemDefault,
  is_tenant_default: row.isTenantDefault,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
  draft: toVersionDto(row.draft),
  published: toVersionDto(row.published),
});

export const toTemplateVersionListItemDto = (row: TemplateVersionListItem) => ({
  id: row.id,
  version_no: row.versionNo,
  width: row.width,
  height: row.height,
  status: row.status,
  published_at: row.publishedAt,
  created_at: row.createdAt,
});

export const toTemplateListItemDto = (row: TemplateListItem) => ({
  id: row.id,
  scope: row.scope,
  tenant_id: row.tenantId,
  type: row.type,
  name: row.name,
  description: row.description,
  is_published: row.isPublished,
  is_active: row.isActive,
  is_system_default: row.isSystemDefault,
  is_tenant_default: row.isTenantDefault,
  thumbnail: row.thumbnail,
  updated_at: row.updatedAt,
});
