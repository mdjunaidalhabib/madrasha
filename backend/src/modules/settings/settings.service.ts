import { BadRequestError, NotFoundError } from "../../shared/errors";
import { storageProvider } from "../../shared/storage";
import { settingsRepository, SettingsRepository } from "./settings.repository";
import {
  BrandingData,
  DocumentTemplatesData,
  IdCardDesignData,
  AdmitCardDesignData,
  LetterDesignData,
} from "./settings.types";
import {
  UpdateBrandingRequestDto,
  UpdateDocumentTemplatesRequestDto,
  UpdateIdCardDesignRequestDto,
  UpdateAdmitCardDesignRequestDto,
  UpdateLetterDesignRequestDto,
} from "./settings.dto";
import {
  TEMPLATE_TOKENS,
  MAX_TEMPLATE_LENGTH,
  MAX_MADRASA_NAME_LENGTH,
  MAX_MADRASA_ADDRESS_LENGTH,
  DEFAULT_WATERMARK_OPACITY,
  BRANDING_IMAGE_FIELDS,
  DOCUMENT_DESIGNS,
  DEFAULT_DOCUMENT_DESIGN,
} from "./settings.constants";

function isValidDesignKey(value: unknown): value is (typeof DOCUMENT_DESIGNS)[number] {
  return typeof value === "string" && (DOCUMENT_DESIGNS as readonly string[]).includes(value);
}

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
      report_banner: madrasa.reportBanner,
      report_watermark: madrasa.reportWatermark,
      report_watermark_opacity: Number(madrasa.reportWatermarkOpacity),
    };
  }

  async updateBranding(madrasaId: number, body: UpdateBrandingRequestDto) {
    const { name, address, report_logo, report_banner, report_watermark, report_watermark_opacity } =
      body;

    for (const [key, value] of Object.entries({ report_logo, report_banner, report_watermark })) {
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
      ...(report_banner !== undefined && report_banner !== null
        ? { reportBanner: storageProvider.persistImage(report_banner) }
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

  async getIdCardDesign(madrasaId: number): Promise<IdCardDesignData> {
    const madrasa = await this.repository.findIdCardDesign(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    return {
      id_card_design: madrasa.idCardDesign || DEFAULT_DOCUMENT_DESIGN,
      id_card_background_image: madrasa.idCardBackgroundImage,
    };
  }

  async updateIdCardDesign(madrasaId: number, body: UpdateIdCardDesignRequestDto) {
    const { id_card_design, id_card_background_image } = body;

    if (id_card_design !== undefined && !isValidDesignKey(id_card_design)) {
      throw new BadRequestError("Invalid id card design");
    }

    if (id_card_background_image !== undefined && !storageProvider.isValidImage(id_card_background_image)) {
      throw new BadRequestError("Invalid image for id_card_background_image");
    }

    await this.repository.updateIdCardDesign(madrasaId, {
      ...(id_card_design !== undefined ? { idCardDesign: id_card_design } : {}),
      ...(id_card_background_image !== undefined
        ? {
            idCardBackgroundImage:
              id_card_background_image === null
                ? null
                : storageProvider.persistImage(id_card_background_image),
          }
        : {}),
    });
  }

  async getAdmitCardDesign(madrasaId: number): Promise<AdmitCardDesignData> {
    const madrasa = await this.repository.findAdmitCardDesign(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    return {
      admit_card_design: madrasa.admitCardDesign || DEFAULT_DOCUMENT_DESIGN,
      admit_card_background_image: madrasa.admitCardBackgroundImage,
    };
  }

  async updateAdmitCardDesign(madrasaId: number, body: UpdateAdmitCardDesignRequestDto) {
    const { admit_card_design, admit_card_background_image } = body;

    if (admit_card_design !== undefined && !isValidDesignKey(admit_card_design)) {
      throw new BadRequestError("Invalid admit card design");
    }

    if (
      admit_card_background_image !== undefined &&
      !storageProvider.isValidImage(admit_card_background_image)
    ) {
      throw new BadRequestError("Invalid image for admit_card_background_image");
    }

    await this.repository.updateAdmitCardDesign(madrasaId, {
      ...(admit_card_design !== undefined ? { admitCardDesign: admit_card_design } : {}),
      ...(admit_card_background_image !== undefined
        ? {
            admitCardBackgroundImage:
              admit_card_background_image === null
                ? null
                : storageProvider.persistImage(admit_card_background_image),
          }
        : {}),
    });
  }

  async getLetterDesign(madrasaId: number): Promise<LetterDesignData> {
    const madrasa = await this.repository.findLetterDesign(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    return {
      letter_design: madrasa.letterDesign || DEFAULT_DOCUMENT_DESIGN,
      letter_background_image: madrasa.letterBackgroundImage,
    };
  }

  async updateLetterDesign(madrasaId: number, body: UpdateLetterDesignRequestDto) {
    const { letter_design, letter_background_image } = body;

    if (letter_design !== undefined && !isValidDesignKey(letter_design)) {
      throw new BadRequestError("Invalid letter design");
    }

    if (letter_background_image !== undefined && !storageProvider.isValidImage(letter_background_image)) {
      throw new BadRequestError("Invalid image for letter_background_image");
    }

    await this.repository.updateLetterDesign(madrasaId, {
      ...(letter_design !== undefined ? { letterDesign: letter_design } : {}),
      ...(letter_background_image !== undefined
        ? {
            letterBackgroundImage:
              letter_background_image === null
                ? null
                : storageProvider.persistImage(letter_background_image),
          }
        : {}),
    });
  }
}

export const settingsService = new SettingsService();
