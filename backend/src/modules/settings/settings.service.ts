import { BadRequestError, NotFoundError } from "../../shared/errors";
import { storageProvider } from "../../shared/storage";
import { settingsRepository, SettingsRepository } from "./settings.repository";
import {
  BrandingData,
  DocumentTemplatesData,
  IdCardDesignData,
  AdmitCardDesignData,
  LetterDesignData,
  BookLabelDesignData,
  MyPlanData,
} from "./settings.types";
import {
  UpdateBrandingRequestDto,
  UpdateDocumentTemplatesRequestDto,
  UpdateIdCardDesignRequestDto,
  UpdateAdmitCardDesignRequestDto,
  UpdateLetterDesignRequestDto,
  UpdateBookLabelDesignRequestDto,
} from "./settings.dto";
import {
  TEMPLATE_TOKENS,
  MAX_TEMPLATE_LENGTH,
  MAX_MADRASA_NAME_LENGTH,
  MAX_MADRASA_ADDRESS_LENGTH,
  MAX_BRANDING_PHONE_LENGTH,
  MAX_BRANDING_EMAIL_LENGTH,
  MAX_BRANDING_CONTACT_ITEMS,
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

/** Trims/drops blank entries and enforces per-item length + item count caps.
 * Returns null (instead of throwing) on a malformed shape so callers can
 * turn that into a single BadRequestError. */
function sanitizeContactList(value: unknown, maxLength: number): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_BRANDING_CONTACT_ITEMS) return null;

  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxLength) return null;
    cleaned.push(trimmed);
  }
  return cleaned;
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
      phones: madrasa.brandingPhones,
      emails: madrasa.brandingEmails,
      report_logo: madrasa.reportLogo,
      report_banner: madrasa.reportBanner,
      report_watermark: madrasa.reportWatermark,
      report_watermark_opacity: Number(madrasa.reportWatermarkOpacity),
    };
  }

  async updateBranding(madrasaId: number, body: UpdateBrandingRequestDto) {
    const {
      name,
      address,
      phones,
      emails,
      report_logo,
      report_banner,
      report_watermark,
      report_watermark_opacity,
    } = body;

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

    let cleanedPhones: string[] | undefined;
    if (phones !== undefined) {
      cleanedPhones = sanitizeContactList(phones, MAX_BRANDING_PHONE_LENGTH) ?? undefined;
      if (!cleanedPhones) throw new BadRequestError("Invalid phone numbers");
    }

    let cleanedEmails: string[] | undefined;
    if (emails !== undefined) {
      cleanedEmails = sanitizeContactList(emails, MAX_BRANDING_EMAIL_LENGTH) ?? undefined;
      if (!cleanedEmails) throw new BadRequestError("Invalid email addresses");
    }

    let opacity: number | undefined;
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
      ...(cleanedPhones !== undefined ? { brandingPhones: { set: cleanedPhones } } : {}),
      ...(cleanedEmails !== undefined ? { brandingEmails: { set: cleanedEmails } } : {}),
      ...(report_logo !== undefined && report_logo !== null
        ? { reportLogo: storageProvider.persistImage(report_logo) }
        : {}),
      ...(report_banner !== undefined && report_banner !== null
        ? { reportBanner: storageProvider.persistImage(report_banner) }
        : {}),
      ...(report_watermark !== undefined && report_watermark !== null
        ? { reportWatermark: storageProvider.persistImage(report_watermark) }
        : {}),
      // Only touch opacity when the caller actually sent it - each field is
      // now saved independently (inline edit UI), so a save of e.g. just the
      // name must not silently reset this back to DEFAULT_WATERMARK_OPACITY.
      ...(opacity !== undefined ? { reportWatermarkOpacity: opacity } : {}),
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

  async getBookLabelDesign(madrasaId: number): Promise<BookLabelDesignData> {
    const madrasa = await this.repository.findBookLabelDesign(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    return {
      book_label_design: madrasa.bookLabelDesign || DEFAULT_DOCUMENT_DESIGN,
      book_label_background_image: madrasa.bookLabelBackgroundImage,
    };
  }

  async updateBookLabelDesign(madrasaId: number, body: UpdateBookLabelDesignRequestDto) {
    const { book_label_design, book_label_background_image } = body;

    if (book_label_design !== undefined && !isValidDesignKey(book_label_design)) {
      throw new BadRequestError("Invalid book label design");
    }

    if (
      book_label_background_image !== undefined &&
      !storageProvider.isValidImage(book_label_background_image)
    ) {
      throw new BadRequestError("Invalid image for book_label_background_image");
    }

    await this.repository.updateBookLabelDesign(madrasaId, {
      ...(book_label_design !== undefined ? { bookLabelDesign: book_label_design } : {}),
      ...(book_label_background_image !== undefined
        ? {
            bookLabelBackgroundImage:
              book_label_background_image === null
                ? null
                : storageProvider.persistImage(book_label_background_image),
          }
        : {}),
    });
  }

  async getMyPlan(madrasaId: number): Promise<MyPlanData> {
    const [madrasa, subscription, students, users] = await Promise.all([
      this.repository.findMadrasaLimits(madrasaId),
      this.repository.findActiveSubscription(madrasaId),
      this.repository.countActiveStudents(madrasaId),
      this.repository.countActiveUsers(madrasaId),
    ]);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    const endDate = subscription?.endDate ?? null;
    let daysRemaining: number | null = null;
    if (endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      daysRemaining = Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    }

    return {
      plan_name: subscription?.plan?.name ?? null,
      price: subscription?.plan?.price !== undefined && subscription?.plan?.price !== null
        ? Number(subscription.plan.price)
        : null,
      duration_days: subscription?.plan?.durationDays ?? null,
      start_date: subscription?.startDate ?? null,
      end_date: endDate,
      days_remaining: daysRemaining,
      plan_status: madrasa.planStatus,
      has_active_subscription: !!subscription,
      // Actual enforced limits live on the Madrasa row itself, not the Plan -
      // assignPlanToMadrasa copies the plan's limits here but a super admin
      // can also override them per-madrasa afterwards (see
      // updateMadrasaLimitsOnTx in superadmin.service.ts), so this is the
      // source of truth for "what this tenant can actually use".
      student_limit: madrasa.studentLimit ?? 0,
      user_limit: madrasa.userLimit ?? 0,
      usage: { students, users },
    };
  }
}

export const settingsService = new SettingsService();
