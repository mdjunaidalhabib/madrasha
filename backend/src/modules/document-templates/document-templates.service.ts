import { DocumentTemplate, DocumentTemplateVersion, DocumentType } from "@prisma/client";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { logActivity } from "../../shared/utils/activity.util";
import { TransactionClient } from "../../shared/database/transaction";
import { documentTemplateRepository, DocumentTemplateRepository } from "./document-templates.repository";
import {
  CanvasBackgroundJson,
  DocumentLayerJson,
  GenerateFilters,
  TemplateActor,
  TemplateDetail,
  TemplateListItem,
  TemplateVersionListItem,
  TemplateVersionSnapshot,
} from "./document-templates.types";
import {
  DEFAULT_CANVAS_SIZE_PX,
  MAX_LAYERS_PER_TEMPLATE,
  MAX_TEMPLATE_DESCRIPTION_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
} from "./document-templates.constants";
import { reportsRepository } from "../reports/reports.repository";

/** Who's asking - resolved from either tenant or super-admin routes into
 * one shape the service can branch on without every method re-deriving it. */
export type TemplateContext =
  | { kind: "tenant"; tenantId: number }
  | { kind: "super_admin" };

const DOCUMENT_TYPES = new Set<DocumentType>([
  "ID_CARD",
  "ADMIT_CARD",
  "CERTIFICATE",
  "CLEARANCE_CERTIFICATE",
  "TESTIMONIAL",
  "MARKSHEET",
  "FEE_RECEIPT",
  "SALARY_SLIP",
]);

export function assertDocumentType(value: unknown): DocumentType {
  if (typeof value === "string" && DOCUMENT_TYPES.has(value as DocumentType)) return value as DocumentType;
  throw new BadRequestError("Invalid or missing document type");
}

function assertName(name: unknown): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new BadRequestError("Template name is required");
  if (trimmed.length > MAX_TEMPLATE_NAME_LENGTH) throw new BadRequestError("Template name is too long");
  return trimmed;
}

function assertLayers(layers: unknown): DocumentLayerJson[] {
  if (!Array.isArray(layers)) throw new BadRequestError("layers must be an array");
  if (layers.length > MAX_LAYERS_PER_TEMPLATE) throw new BadRequestError("Too many layers on this template");
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") throw new BadRequestError("Invalid layer entry");
    const l = layer as Record<string, unknown>;
    if (typeof l.id !== "string" || !l.id) throw new BadRequestError("Every layer needs an id");
    if (typeof l.type !== "string") throw new BadRequestError("Every layer needs a type");
    for (const key of ["x", "y", "width", "height", "rotation"]) {
      if (typeof l[key] !== "number" || !Number.isFinite(l[key] as number)) {
        throw new BadRequestError(`Layer "${l.id}" has an invalid ${key}`);
      }
    }
  }
  return layers as DocumentLayerJson[];
}

const toVersionSnapshot = (row: DocumentTemplateVersion): TemplateVersionSnapshot => ({
  id: row.id,
  versionNo: row.versionNo,
  width: row.width,
  height: row.height,
  background: (row.background as CanvasBackgroundJson | null) ?? null,
  layers: (row.layers as unknown as DocumentLayerJson[]) ?? [],
  status: row.status,
  publishedAt: row.publishedAt,
});

export class DocumentTemplateService {
  constructor(
    private readonly repository: DocumentTemplateRepository = documentTemplateRepository,
    private readonly reports = reportsRepository,
  ) {}

  /* ============================================================
     READ
  ============================================================ */

  async listForTenant(tenantId: number, type: DocumentType): Promise<TemplateListItem[]> {
    const [rows, tenantDefault] = await Promise.all([
      this.repository.findReadableForTenant(tenantId, type),
      this.repository.findTenantDefault(tenantId, type),
    ]);

    return rows.map((row) => this.toListItem(row, tenantDefault?.templateId ?? null));
  }

  async listSystemTemplates(type?: DocumentType): Promise<TemplateListItem[]> {
    const rows = await this.repository.findSystemTemplates(type);
    return rows.map((row) => this.toListItem(row, null));
  }

  private toListItem(row: DocumentTemplate, tenantDefaultTemplateId: number | null): TemplateListItem {
    return {
      id: row.id,
      scope: row.scope,
      tenantId: row.tenantId,
      type: row.type,
      name: row.name,
      description: row.description,
      isPublished: row.isPublished,
      isActive: row.isActive,
      isSystemDefault: row.isSystemDefault,
      isTenantDefault: row.id === tenantDefaultTemplateId,
      thumbnail: null, // resolved lazily by the frontend detail call; list stays cheap
      updatedAt: row.updatedAt,
    };
  }

  async getDetail(id: number, context: TemplateContext): Promise<TemplateDetail> {
    const row = await this.loadReadable(id, context);
    return this.toDetail(row, context);
  }

  private async toDetail(row: DocumentTemplate, context: TemplateContext): Promise<TemplateDetail> {
    const [draftRow, publishedRow, tenantDefault] = await Promise.all([
      row.currentVersionId ? this.repository.findVersionById(row.currentVersionId) : null,
      row.publishedVersionId ? this.repository.findVersionById(row.publishedVersionId) : null,
      context.kind === "tenant" ? this.repository.findTenantDefault(context.tenantId, row.type) : null,
    ]);

    return {
      id: row.id,
      scope: row.scope,
      tenantId: row.tenantId,
      type: row.type,
      name: row.name,
      description: row.description,
      clonedFromId: row.clonedFromId,
      isPublished: row.isPublished,
      isActive: row.isActive,
      isSystemDefault: row.isSystemDefault,
      isTenantDefault: Boolean(tenantDefault && tenantDefault.templateId === row.id),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      draft: draftRow ? toVersionSnapshot(draftRow) : null,
      published: publishedRow ? toVersionSnapshot(publishedRow) : null,
    };
  }

  /** A row this context is allowed to VIEW (not necessarily edit). */
  private async loadReadable(id: number, context: TemplateContext): Promise<DocumentTemplate> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundError("Template not found");

    if (context.kind === "super_admin") {
      if (row.scope !== "SYSTEM") throw new NotFoundError("Template not found");
      return row;
    }

    if (row.scope === "TENANT" && row.tenantId === context.tenantId) return row;
    if (row.scope === "SYSTEM" && row.isPublished && row.isActive) return row;
    // Deliberately 404, not 403 - existence of another tenant's private
    // template must not be observable.
    throw new NotFoundError("Template not found");
  }

  /** A row this context is allowed to EDIT (owns outright). */
  private async loadOwned(id: number, context: TemplateContext): Promise<DocumentTemplate> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundError("Template not found");

    if (context.kind === "super_admin") {
      if (row.scope !== "SYSTEM") throw new NotFoundError("Template not found");
      return row;
    }

    if (row.scope === "TENANT" && row.tenantId === context.tenantId) return row;
    throw new NotFoundError("Template not found");
  }

  /* ============================================================
     CREATE / CLONE
  ============================================================ */

  async createTemplate(
    context: TemplateContext,
    actor: TemplateActor,
    body: { type?: DocumentType; name: string; description?: string | null; sourceTemplateId?: number },
  ): Promise<TemplateDetail> {
    const name = assertName(body.name);
    const description =
      body.description && String(body.description).trim()
        ? String(body.description).trim().slice(0, MAX_TEMPLATE_DESCRIPTION_LENGTH)
        : null;

    let type: DocumentType;
    let width: number;
    let height: number;
    let background: CanvasBackgroundJson | null;
    let layers: DocumentLayerJson[];
    let clonedFromId: number | null = null;

    if (body.sourceTemplateId) {
      const source = await this.loadReadable(body.sourceTemplateId, context);
      if (body.type && source.type !== body.type) throw new BadRequestError("Source template type mismatch");
      type = source.type;
      const sourceVersionId = source.publishedVersionId ?? source.currentVersionId;
      const sourceVersion = sourceVersionId ? await this.repository.findVersionById(sourceVersionId) : null;
      width = sourceVersion?.width ?? DEFAULT_CANVAS_SIZE_PX[type].width;
      height = sourceVersion?.height ?? DEFAULT_CANVAS_SIZE_PX[type].height;
      background = (sourceVersion?.background as CanvasBackgroundJson | null) ?? null;
      layers = ((sourceVersion?.layers as unknown as DocumentLayerJson[]) ?? []).map((l) => ({ ...l }));
      clonedFromId = source.id;
    } else {
      if (!body.type) throw new BadRequestError("type is required");
      type = body.type;
      width = DEFAULT_CANVAS_SIZE_PX[type].width;
      height = DEFAULT_CANVAS_SIZE_PX[type].height;
      background = null;
      layers = [];
    }

    const row = await this.repository.runTransaction(async (tx) => {
      const template = await this.repository.createOnTx(tx, {
        scope: context.kind === "tenant" ? "TENANT" : "SYSTEM",
        tenantId: context.kind === "tenant" ? context.tenantId : null,
        type,
        name,
        description,
        clonedFromId,
        createdByRole: actor.role,
        createdByUserId: actor.role === "TENANT_USER" ? actor.userId : null,
        createdBySuperAdminId: actor.role === "SUPER_ADMIN" ? actor.superAdminId : null,
      });

      const version = await this.repository.createVersionOnTx(tx, {
        templateId: template.id,
        versionNo: 1,
        width,
        height,
        background: background ?? undefined,
        layers,
        status: "DRAFT",
      });

      return this.repository.updateOnTx(tx, template.id, { currentVersionId: version.id });
    });

    await this.logActorActivity(context, actor, clonedFromId ? "document_template.clone" : "document_template.create", row.id);

    return this.toDetail(row, context);
  }

  /* ============================================================
     DRAFT SAVE (autosave)
  ============================================================ */

  async saveDraft(
    id: number,
    context: TemplateContext,
    body: { width?: number; height?: number; background?: CanvasBackgroundJson | null; layers?: DocumentLayerJson[] },
  ): Promise<TemplateDetail> {
    const template = await this.loadOwned(id, context);
    if (!template.currentVersionId) throw new ConflictError("Template has no draft version");

    const current = await this.repository.findVersionById(template.currentVersionId);
    if (!current) throw new ConflictError("Template has no draft version");
    const draft = await this.ensureDraftVersion(template.id, current);

    const data: Record<string, unknown> = {};
    if (body.width !== undefined) {
      if (!Number.isFinite(body.width) || body.width <= 0) throw new BadRequestError("Invalid width");
      data.width = body.width;
    }
    if (body.height !== undefined) {
      if (!Number.isFinite(body.height) || body.height <= 0) throw new BadRequestError("Invalid height");
      data.height = body.height;
    }
    if (body.background !== undefined) data.background = body.background;
    if (body.layers !== undefined) data.layers = assertLayers(body.layers);

    await this.repository.updateVersion(draft.id, data);

    const refreshed = await this.repository.findById(id);
    return this.toDetail(refreshed!, context);
  }

  /** Guarantees `currentVersionId` points at a DRAFT row, self-healing
   * templates whose current version was left PUBLISHED by a creation path
   * that never opened a follow-up draft (legacy-template-migration.service.ts
   * and prisma/seed.ts both did this before it was caught - existing rows
   * created that way get repaired here on first edit instead of needing a
   * data migration). Mirrors the draft `publish()` opens after publishing. */
  private async ensureDraftVersion(
    templateId: number,
    current: DocumentTemplateVersion,
  ): Promise<DocumentTemplateVersion> {
    if (current.status === "DRAFT") return current;

    return this.repository.runTransaction(async (tx) => {
      const nextVersionNo = (await this.repository.maxVersionNoOnTx(tx, templateId)) + 1;
      const draft = await this.repository.createVersionOnTx(tx, {
        templateId,
        versionNo: nextVersionNo,
        width: current.width,
        height: current.height,
        background: current.background ?? undefined,
        layers: current.layers as any,
        status: "DRAFT",
      });
      await this.repository.updateOnTx(tx, templateId, { currentVersionId: draft.id });
      return draft;
    });
  }

  /* ============================================================
     VERSION HISTORY
  ============================================================ */

  async listVersions(id: number, context: TemplateContext): Promise<TemplateVersionListItem[]> {
    const template = await this.loadReadable(id, context);
    const versions = await this.repository.findVersionsForTemplate(template.id);
    return versions.map((v) => ({
      id: v.id,
      versionNo: v.versionNo,
      width: v.width,
      height: v.height,
      status: v.status,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
    }));
  }

  /** Copies an old version's content into the CURRENT DRAFT - never touches
   * `publishedVersionId`, so a previously published snapshot is never
   * destroyed. Restoring only seeds the draft; the user still has to
   * `publish()` to make it live. */
  async restoreVersion(
    id: number,
    versionId: number,
    context: TemplateContext,
    actor: TemplateActor,
  ): Promise<TemplateDetail> {
    const template = await this.loadOwned(id, context);
    if (!template.currentVersionId) throw new ConflictError("Template has no draft version");

    const target = await this.repository.findVersionById(versionId);
    if (!target || target.templateId !== template.id) throw new NotFoundError("Version not found");

    const current = await this.repository.findVersionById(template.currentVersionId);
    if (!current) throw new ConflictError("Template has no draft version");
    const draft = await this.ensureDraftVersion(template.id, current);

    await this.repository.updateVersion(draft.id, {
      width: target.width,
      height: target.height,
      background: target.background ?? undefined,
      layers: target.layers as unknown,
    });

    await this.logActorActivity(context, actor, "document_template.version_restore", id);

    const refreshed = await this.repository.findById(id);
    return this.toDetail(refreshed!, context);
  }

  /* ============================================================
     PUBLISH
  ============================================================ */

  async publish(id: number, context: TemplateContext, actor: TemplateActor): Promise<TemplateDetail> {
    const template = await this.loadOwned(id, context);
    if (!template.currentVersionId) throw new ConflictError("Template has no draft version to publish");

    const updated = await this.repository.runTransaction(async (tx) => {
      const draft = await tx.documentTemplateVersion.findUnique({ where: { id: template.currentVersionId! } });
      if (!draft) throw new ConflictError("Template has no draft version to publish");
      if (draft.status === "PUBLISHED") throw new ConflictError("This version is already published");

      const now = new Date();
      await this.repository.updateVersionOnTx(tx, draft.id, { status: "PUBLISHED", publishedAt: now });

      const nextVersionNo = (await this.repository.maxVersionNoOnTx(tx, template.id)) + 1;
      const nextDraft = await this.repository.createVersionOnTx(tx, {
        templateId: template.id,
        versionNo: nextVersionNo,
        width: draft.width,
        height: draft.height,
        background: draft.background ?? undefined,
        layers: draft.layers as any,
        status: "DRAFT",
      });

      return this.repository.updateOnTx(tx, template.id, {
        isPublished: true,
        publishedVersionId: draft.id,
        currentVersionId: nextDraft.id,
      });
    });

    await this.logActorActivity(context, actor, "document_template.publish", id);

    return this.toDetail(updated, context);
  }

  /* ============================================================
     META / DELETE / DEFAULTS
  ============================================================ */

  async updateMeta(
    id: number,
    context: TemplateContext,
    actor: TemplateActor,
    body: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<TemplateDetail> {
    await this.loadOwned(id, context);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = assertName(body.name);
    if (body.description !== undefined) {
      data.description = body.description ? String(body.description).trim().slice(0, MAX_TEMPLATE_DESCRIPTION_LENGTH) : null;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const row = await this.repository.update(id, data);
    await this.logActorActivity(context, actor, "document_template.update", id);
    return this.toDetail(row, context);
  }

  async deleteTemplate(id: number, context: TemplateContext, actor: TemplateActor): Promise<void> {
    const template = await this.loadOwned(id, context);

    if (template.isSystemDefault) {
      throw new ConflictError("Unset this as the system default before deleting it");
    }

    const defaultsUsing = await this.repository.countTenantDefaultsUsingTemplate(id);
    if (defaultsUsing > 0) {
      throw new ConflictError("This template is currently set as a tenant default and cannot be deleted");
    }

    await this.repository.deleteById(id);
    await this.logActorActivity(context, actor, "document_template.delete", id);
  }

  async setSystemDefault(id: number, superAdminId: number): Promise<TemplateDetail> {
    const template = await this.loadOwned(id, { kind: "super_admin" });
    if (!template.isPublished) throw new BadRequestError("Publish the template before setting it as default");

    const updated = await this.repository.runTransaction(async (tx) => {
      await this.repository.unsetSystemDefaultOnTx(tx, template.type);
      return this.repository.updateOnTx(tx, id, { isSystemDefault: true });
    });

    await logActivity({
      madrasa_id: null,
      user_id: superAdminId,
      action: "document_template.set_system_default",
      entity: "DocumentTemplate",
      entity_id: id,
    });

    return this.toDetail(updated, { kind: "super_admin" });
  }

  async getEffectiveDefault(
    tenantId: number,
    type: DocumentType,
    ensureMigrated: (tenantId: number, type: DocumentType) => Promise<void>,
  ): Promise<TemplateDetail> {
    let tenantDefault = await this.repository.findTenantDefault(tenantId, type);

    if (!tenantDefault) {
      await ensureMigrated(tenantId, type);
      tenantDefault = await this.repository.findTenantDefault(tenantId, type);
    }

    if (!tenantDefault) throw new NotFoundError("No default template available for this document type");

    const row = await this.repository.findById(tenantDefault.templateId);
    if (!row) throw new NotFoundError("Default template no longer exists");

    return this.toDetail(row, { kind: "tenant", tenantId });
  }

  async setTenantDefault(
    tenantId: number,
    type: DocumentType,
    templateId: number,
    actor: TemplateActor,
  ): Promise<void> {
    // Must be something this tenant is actually allowed to use: their own
    // template, or a published system template.
    const row = await this.loadReadable(templateId, { kind: "tenant", tenantId });
    if (row.type !== type) throw new BadRequestError("Template type does not match");

    await this.repository.upsertTenantDefault(tenantId, type, templateId);
    await this.logActorActivity({ kind: "tenant", tenantId }, actor, "document_template.set_tenant_default", templateId);
  }

  /** One real row of this tenant's own data for the designer's live
   * preview - never persisted, just handed back to the frontend so the
   * canvas can render actual field values instead of placeholder text. */
  async getPreviewRow(tenantId: number, type: DocumentType): Promise<Record<string, unknown> | null> {
    if (type === "ID_CARD") {
      const rows = await this.reports.findStudentIdCards(tenantId, {});
      return (rows as Record<string, unknown>[])[0] ?? null;
    }
    if (type === "ADMIT_CARD") {
      const result = await this.reports.findStudentAdmitCards(tenantId, {});
      return (result.rows as Record<string, unknown>[])[0] ?? null;
    }
    if (type === "CERTIFICATE") {
      const rows = await this.reports.findStudentSanads(tenantId, {});
      return (rows.rows as Record<string, unknown>[])[0] ?? null;
    }
    if (type === "TESTIMONIAL") {
      const rows = await this.reports.findStudentCertificates(tenantId, {});
      return (rows as Record<string, unknown>[])[0] ?? null;
    }
    if (type === "CLEARANCE_CERTIFICATE") {
      const rows = await this.reports.findStudentTransferLetters(tenantId, {});
      return (rows as Record<string, unknown>[])[0] ?? null;
    }
    if (type === "MARKSHEET") {
      const result = await this.reports.findStudentMarksheets(tenantId, {});
      return (result.rows as Record<string, unknown>[])[0] ?? null;
    }
    return null;
  }

  /* ============================================================
     GENERATE
  ============================================================ */

  async generate(
    tenantId: number,
    type: DocumentType,
    templateId: number | undefined,
    filters: GenerateFilters,
    ensureMigrated: (tenantId: number, type: DocumentType) => Promise<void>,
  ) {
    const detail = templateId
      ? await this.getDetail(templateId, { kind: "tenant", tenantId })
      : await this.getEffectiveDefault(tenantId, type, ensureMigrated);

    const version = detail.published ?? detail.draft;
    if (!version) throw new ConflictError("This template has no published version yet");

    let rows: Record<string, unknown>[];
    if (type === "ID_CARD") {
      const result = await this.reports.findStudentIdCards(tenantId, filters);
      rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
    } else if (type === "ADMIT_CARD") {
      const result = await this.reports.findStudentAdmitCards(tenantId, filters);
      rows = (result as any)?.rows ?? [];
    } else if (type === "CERTIFICATE") {
      const result = await this.reports.findStudentSanads(tenantId, filters);
      rows = (result as any)?.rows ?? [];
    } else if (type === "TESTIMONIAL") {
      const result = await this.reports.findStudentCertificates(tenantId, filters);
      rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
    } else if (type === "CLEARANCE_CERTIFICATE") {
      const result = await this.reports.findStudentTransferLetters(tenantId, filters);
      rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];
    } else if (type === "MARKSHEET") {
      const result = await this.reports.findStudentMarksheets(tenantId, filters);
      rows = (result as any)?.rows ?? [];
    } else {
      throw new BadRequestError(`Bulk generation for ${type} is not wired up yet`);
    }

    return {
      template: {
        id: detail.id,
        name: detail.name,
        width: version.width,
        height: version.height,
        background: version.background,
        layers: version.layers,
      },
      rows,
    };
  }

  /* ============================================================
     helpers
  ============================================================ */

  private async logActorActivity(
    context: TemplateContext,
    actor: TemplateActor,
    action: string,
    entityId: number,
  ) {
    await logActivity({
      madrasa_id: context.kind === "tenant" ? context.tenantId : null,
      user_id: actor.role === "TENANT_USER" ? actor.userId : actor.superAdminId,
      action,
      entity: "DocumentTemplate",
      entity_id: entityId,
    });
  }
}

export const documentTemplateService = new DocumentTemplateService();
