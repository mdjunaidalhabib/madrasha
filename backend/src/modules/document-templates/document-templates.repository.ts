import { DocumentType, DocumentTemplateVersionStatus, Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { TransactionClient } from "../../shared/database/transaction";

/** Loosely-typed version payload accepted by the repository - `background`/
 * `layers` are plain JSON-serializable objects (DocumentLayerJson[] /
 * CanvasBackgroundJson at the call sites), which don't structurally satisfy
 * Prisma's generated `InputJsonValue` (it requires an index signature).
 * Cast once here at the Prisma boundary instead of forcing every call site
 * to fight the generated type. */
interface VersionCreateData {
  templateId: number;
  versionNo: number;
  width: number;
  height: number;
  background?: unknown;
  layers: unknown;
  status?: DocumentTemplateVersionStatus;
  publishedAt?: Date | null;
}

interface VersionUpdateData {
  width?: number;
  height?: number;
  background?: unknown;
  layers?: unknown;
  status?: DocumentTemplateVersionStatus;
  publishedAt?: Date | null;
}

export class DocumentTemplateRepository {
  findById(id: number) {
    return prisma.documentTemplate.findUnique({ where: { id } });
  }

  /** Only rows this tenant owns outright (TENANT scope, same tenantId). */
  findByIdForTenant(id: number, tenantId: number) {
    return prisma.documentTemplate.findFirst({ where: { id, scope: "TENANT", tenantId } });
  }

  findSystemById(id: number) {
    return prisma.documentTemplate.findFirst({ where: { id, scope: "SYSTEM" } });
  }

  /** Anything a tenant is allowed to read for a type: their own TENANT
   * templates, plus published+active SYSTEM templates. */
  findReadableForTenant(tenantId: number, type: DocumentType) {
    return prisma.documentTemplate.findMany({
      where: {
        type,
        isActive: true,
        OR: [
          { scope: "TENANT", tenantId },
          { scope: "SYSTEM", isPublished: true },
        ],
      },
      orderBy: [{ scope: "asc" }, { updatedAt: "desc" }],
    });
  }

  findSystemTemplates(type?: DocumentType) {
    return prisma.documentTemplate.findMany({
      where: { scope: "SYSTEM", ...(type ? { type } : {}) },
      orderBy: { updatedAt: "desc" },
    });
  }

  create(data: Prisma.DocumentTemplateUncheckedCreateInput) {
    return prisma.documentTemplate.create({ data });
  }

  createOnTx(tx: TransactionClient, data: Prisma.DocumentTemplateUncheckedCreateInput) {
    return tx.documentTemplate.create({ data });
  }

  update(id: number, data: Prisma.DocumentTemplateUpdateInput) {
    return prisma.documentTemplate.update({ where: { id }, data });
  }

  updateOnTx(tx: TransactionClient, id: number, data: Prisma.DocumentTemplateUpdateInput) {
    return tx.documentTemplate.update({ where: { id }, data });
  }

  deleteById(id: number) {
    return prisma.documentTemplate.delete({ where: { id } });
  }

  unsetSystemDefaultOnTx(tx: TransactionClient, type: DocumentType) {
    return tx.documentTemplate.updateMany({
      where: { scope: "SYSTEM", type, isSystemDefault: true },
      data: { isSystemDefault: false },
    });
  }

  /* ---------------- versions ---------------- */

  findVersionById(id: number) {
    return prisma.documentTemplateVersion.findUnique({ where: { id } });
  }

  findVersionsForTemplate(templateId: number) {
    return prisma.documentTemplateVersion.findMany({
      where: { templateId },
      orderBy: { versionNo: "desc" },
    });
  }

  createVersion(data: VersionCreateData) {
    return prisma.documentTemplateVersion.create({
      data: data as Prisma.DocumentTemplateVersionUncheckedCreateInput,
    });
  }

  createVersionOnTx(tx: TransactionClient, data: VersionCreateData) {
    return tx.documentTemplateVersion.create({
      data: data as Prisma.DocumentTemplateVersionUncheckedCreateInput,
    });
  }

  updateVersion(id: number, data: VersionUpdateData) {
    return prisma.documentTemplateVersion.update({
      where: { id },
      data: data as Prisma.DocumentTemplateVersionUpdateInput,
    });
  }

  updateVersionOnTx(tx: TransactionClient, id: number, data: VersionUpdateData) {
    return tx.documentTemplateVersion.update({
      where: { id },
      data: data as Prisma.DocumentTemplateVersionUpdateInput,
    });
  }

  async maxVersionNoOnTx(tx: TransactionClient, templateId: number): Promise<number> {
    const result = await tx.documentTemplateVersion.aggregate({
      where: { templateId },
      _max: { versionNo: true },
    });
    return result._max.versionNo ?? 0;
  }

  /* ---------------- tenant default ---------------- */

  findTenantDefault(madrasaId: number, type: DocumentType) {
    return prisma.tenantDocumentDefault.findUnique({ where: { madrasaId_type: { madrasaId, type } } });
  }

  findTenantDefaultOnTx(tx: TransactionClient, madrasaId: number, type: DocumentType) {
    return tx.tenantDocumentDefault.findUnique({ where: { madrasaId_type: { madrasaId, type } } });
  }

  upsertTenantDefault(madrasaId: number, type: DocumentType, templateId: number) {
    return prisma.tenantDocumentDefault.upsert({
      where: { madrasaId_type: { madrasaId, type } },
      create: { madrasaId, type, templateId },
      update: { templateId },
    });
  }

  upsertTenantDefaultOnTx(
    tx: TransactionClient,
    madrasaId: number,
    type: DocumentType,
    templateId: number,
  ) {
    return tx.tenantDocumentDefault.upsert({
      where: { madrasaId_type: { madrasaId, type } },
      create: { madrasaId, type, templateId },
      update: { templateId },
    });
  }

  countTenantDefaultsUsingTemplate(templateId: number) {
    return prisma.tenantDocumentDefault.count({ where: { templateId } });
  }

  findTenantDefaultsByType(madrasaId: number, types: DocumentType[]) {
    return prisma.tenantDocumentDefault.findMany({ where: { madrasaId, type: { in: types } } });
  }

  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const documentTemplateRepository = new DocumentTemplateRepository();
