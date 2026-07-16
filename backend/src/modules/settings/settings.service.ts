import { BadRequestError, NotFoundError } from "../../shared/errors";
import { storageProvider } from "../../shared/storage";
import { settingsRepository, SettingsRepository } from "./settings.repository";
import { BrandingData, DocumentTemplatesData } from "./settings.types";
import { UpdateBrandingRequestDto, UpdateDocumentTemplatesRequestDto } from "./settings.dto";
import {
  TEMPLATE_TOKENS,
  MAX_TEMPLATE_LENGTH,
  MAX_MADRASA_NAME_LENGTH,
  MAX_MADRASA_ADDRESS_LENGTH,
  DEFAULT_WATERMARK_OPACITY,
  BRANDING_IMAGE_FIELDS,
} from "./settings.constants";

function isValidTextValue(value: unknown, maxLength: number): value is string | null {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  if (value.length > maxLength) return false;
  return true;
}

function isValidTemplateValue(value: unknown): value is string | null {
  return isValidTextValue(value, MAX_TEMPLATE_LENGTH);
}

export class SettingsService {
  constructor(private readonly repository: SettingsRepository = settingsRepository) {}

  async listDivisions(madrasaId: number) {
    const rows = await this.repository.findActiveDivisions(madrasaId);
    return rows.map((r) => ({ id: r.division.id, name_bn: r.division.nameBn }));
  }

  async listClassesByDivision(madrasaId: number, divisionId: number) {
    const rows = await this.repository.findActiveClassesByDivision(madrasaId, divisionId);
    return rows.map((r) => ({ id: r.class.id, name_bn: r.class.nameBn }));
  }

  async getBranding(madrasaId: number): Promise<BrandingData> {
    const madrasa = await this.repository.findBranding(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    return {
      name: madrasa.name,
      address: madrasa.address,
      report_logo: madrasa.reportLogo,
      report_watermark: madrasa.reportWatermark,
      report_watermark_opacity: madrasa.reportWatermarkOpacity,
    };
  }

  async updateBranding(madrasaId: number, body: UpdateBrandingRequestDto) {
    const { name, address, report_logo, report_watermark, report_watermark_opacity } = body;

    for (const [key, value] of Object.entries({ report_logo, report_watermark })) {
      if (value !== undefined && !storageProvider.isValidImage(value)) {
        throw new BadRequestError(`Invalid image for ${key}`);
      }
    }

    if (name !== undefined && !isValidTextValue(name, MAX_MADRASA_NAME_LENGTH)) {
      throw new BadRequestError("Invalid madrasa name");
    }

    if (address !== undefined && !isValidTextValue(address, MAX_MADRASA_ADDRESS_LENGTH)) {
      throw new BadRequestError("Invalid madrasa address");
    }

    if (name !== undefined && (name === null || String(name).trim() === "")) {
      throw new BadRequestError("Madrasa name cannot be empty");
    }

    let opacity = DEFAULT_WATERMARK_OPACITY;
    if (report_watermark_opacity !== undefined && report_watermark_opacity !== null) {
      opacity = Number(report_watermark_opacity);
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        throw new BadRequestError("Watermark opacity must be between 0 and 1");
      }
    }

    await this.repository.updateBranding(madrasaId, {
      // COALESCE(NULLIF(?, ''), name): only overwrite if a non-empty name given
      ...(name !== undefined && String(name).trim() !== "" ? { name } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(report_logo !== undefined && report_logo !== null
        ? { reportLogo: storageProvider.persistImage(report_logo) }
        : {}),
      ...(report_watermark !== undefined && report_watermark !== null
        ? { reportWatermark: storageProvider.persistImage(report_watermark) }
        : {}),
      reportWatermarkOpacity: opacity,
    });
  }

  async deleteBrandingImage(madrasaId: number, field: string) {
    const mapped = BRANDING_IMAGE_FIELDS[field];
    if (!mapped) throw new BadRequestError("Invalid field");

    await this.repository.updateField(madrasaId, mapped, null);
  }

  async getDocumentTemplates(madrasaId: number): Promise<DocumentTemplatesData> {
    const madrasa = await this.repository.findDocumentTemplates(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    return {
      sanad_template: madrasa.sanadTemplate,
      testimonial_template: madrasa.testimonialTemplate,
      transfer_letter_template: madrasa.transferLetterTemplate,
      admit_card_rules: madrasa.admitCardRules,
      tokens: TEMPLATE_TOKENS,
    };
  }

  async updateDocumentTemplates(madrasaId: number, body: UpdateDocumentTemplatesRequestDto) {
    const { sanad_template, testimonial_template, transfer_letter_template, admit_card_rules } = body;

    for (const [key, value] of Object.entries({
      sanad_template,
      testimonial_template,
      transfer_letter_template,
      admit_card_rules,
    })) {
      if (value !== undefined && !isValidTemplateValue(value)) {
        throw new BadRequestError(`Invalid text for ${key} (max ${MAX_TEMPLATE_LENGTH} characters)`);
      }
    }

    await this.repository.updateDocumentTemplates(madrasaId, {
      ...(sanad_template !== undefined ? { sanadTemplate: sanad_template } : {}),
      ...(testimonial_template !== undefined ? { testimonialTemplate: testimonial_template } : {}),
      ...(transfer_letter_template !== undefined
        ? { transferLetterTemplate: transfer_letter_template }
        : {}),
      ...(admit_card_rules !== undefined ? { admitCardRules: admit_card_rules } : {}),
    });
  }
}

export const settingsService = new SettingsService();
