import { DocumentType } from "@prisma/client";
import { settingsRepository, SettingsRepository } from "../settings/settings.repository";
import { DEFAULT_DOCUMENT_DESIGN } from "../settings/settings.constants";
import { documentTemplateRepository, DocumentTemplateRepository } from "./document-templates.repository";
import { DEFAULT_CANVAS_SIZE_PX } from "./document-templates.constants";
import { logActivity } from "../../shared/utils/activity.util";
import {
  buildAdmitCardBackground,
  buildAdmitCardLayers,
  buildIdCardBackground,
  buildIdCardLayers,
  isKnownPreset,
  PresetKey,
} from "./preset-layer-builders";

/**
 * Turns a tenant's current legacy design selection (one of the 4 fixed
 * classic/minimal/arch/custom presets, stored as plain Madrasa columns -
 * see settings.repository.ts) into a real, tenant-owned DocumentTemplate
 * the first time it's needed, so nothing breaks for a tenant who hasn't
 * opened the new template UI yet.
 *
 * Always creates an independent TENANT-scope copy, never a pointer at the
 * SYSTEM template of the same preset name: a tenant's own uploaded
 * "custom" background is tenant-specific data, and a Super Admin later
 * republishing the SYSTEM "classic" template must never retroactively
 * change what this tenant already had before this feature existed.
 */
export class LegacyTemplateMigrationService {
  constructor(
    private readonly settings: SettingsRepository = settingsRepository,
    private readonly templates: DocumentTemplateRepository = documentTemplateRepository,
  ) {}

  async ensureMigrated(madrasaId: number, type: DocumentType): Promise<void> {
    if (type !== "ID_CARD" && type !== "ADMIT_CARD") return; // only these 2 types have a legacy source to migrate from

    // Idempotency: re-check inside the same transaction below so two
    // concurrent requests for a never-migrated tenant can't both create one.
    await this.templates.runTransaction(async (tx) => {
      const existing = await this.templates.findTenantDefaultOnTx(tx, madrasaId, type);
      if (existing) return;

      const { preset, backgroundImage } = await this.resolveLegacyDesign(madrasaId, type);
      const { width, height } = DEFAULT_CANVAS_SIZE_PX[type];
      const layers = type === "ID_CARD" ? buildIdCardLayers(preset, backgroundImage) : buildAdmitCardLayers(preset);
      const background =
        type === "ID_CARD"
          ? buildIdCardBackground(preset, backgroundImage)
          : buildAdmitCardBackground(preset, backgroundImage);

      const templateName =
        type === "ID_CARD" ? `আইডি কার্ড (${presetLabel(preset)})` : `প্রবেশপত্র (${presetLabel(preset)})`;

      const template = await this.templates.createOnTx(tx, {
        scope: "TENANT",
        tenantId: madrasaId,
        type,
        name: templateName,
        description: "পূর্ববর্তী ডিজাইন থেকে স্বয়ংক্রিয়ভাবে তৈরি",
        createdByRole: "TENANT_USER",
        createdByUserId: null,
        isPublished: true,
      });

      const version = await this.templates.createVersionOnTx(tx, {
        templateId: template.id,
        versionNo: 1,
        width,
        height,
        background,
        layers,
        status: "PUBLISHED",
        publishedAt: new Date(),
      });

      await this.templates.updateOnTx(tx, template.id, {
        currentVersionId: version.id,
        publishedVersionId: version.id,
      });

      await this.templates.upsertTenantDefaultOnTx(tx, madrasaId, type, template.id);
    });

    await logActivity({
      madrasa_id: madrasaId,
      user_id: null,
      action: "document_template.auto_migrated",
      entity: "DocumentTemplate",
      details: type,
    });
  }

  private async resolveLegacyDesign(
    madrasaId: number,
    type: DocumentType,
  ): Promise<{ preset: PresetKey; backgroundImage: string | null }> {
    if (type === "ID_CARD") {
      const row = await this.settings.findIdCardDesign(madrasaId);
      const preset = isKnownPreset(row?.idCardDesign) ? row!.idCardDesign : DEFAULT_DOCUMENT_DESIGN;
      return { preset: preset as PresetKey, backgroundImage: row?.idCardBackgroundImage ?? null };
    }

    const row = await this.settings.findAdmitCardDesign(madrasaId);
    const preset = isKnownPreset(row?.admitCardDesign) ? row!.admitCardDesign : DEFAULT_DOCUMENT_DESIGN;
    return { preset: preset as PresetKey, backgroundImage: row?.admitCardBackgroundImage ?? null };
  }
}

function presetLabel(preset: PresetKey): string {
  switch (preset) {
    case "classic":
      return "ধ্রুপদী";
    case "minimal":
      return "মিনিমাল";
    case "arch":
      return "খিলান";
    default:
      return "কাস্টম";
  }
}

export const legacyTemplateMigrationService = new LegacyTemplateMigrationService();
