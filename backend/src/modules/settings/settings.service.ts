import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { storageProvider } from "../../shared/storage";
import { logActivity } from "../../shared/utils/activity.util";
import { settingsRepository, SettingsRepository } from "./settings.repository";
import {
  BrandingData,
  BrandLayoutData,
  DocumentTemplatesData,
  IdCardDesignData,
  AdmitCardDesignData,
  LetterDesignData,
  BookLabelDesignData,
  IdCardBackData,
  MarksheetFieldItem,
  AdmitCardFieldItem,
  SocialLinkItem,
  MyPlanData,
  SectionTogglesData,
} from "./settings.types";
import {
  UpdateBrandingRequestDto,
  UpdateBrandLayoutRequestDto,
  UpdateDocumentTemplatesRequestDto,
  UpdateIdCardDesignRequestDto,
  UpdateAdmitCardDesignRequestDto,
  UpdateLetterDesignRequestDto,
  UpdateBookLabelDesignRequestDto,
  UpdateIdCardBackRequestDto,
  UpdateSectionToggleRequestDto,
} from "./settings.dto";
import {
  TEMPLATE_TOKENS,
  MAX_TEMPLATE_LENGTH,
  MAX_MADRASA_NAME_LENGTH,
  MAX_MADRASA_ADDRESS_LENGTH,
  MAX_BRANDING_PHONE_LENGTH,
  MAX_BRANDING_EMAIL_LENGTH,
  MAX_BRANDING_CONTACT_ITEMS,
  SOCIAL_LINK_TYPES,
  MAX_SOCIAL_LINKS,
  MAX_SOCIAL_LINK_VALUE_LENGTH,
  MAX_SOCIAL_LINK_LABEL_LENGTH,
  BRANDING_IMAGE_FIELDS,
  DOCUMENT_DESIGNS,
  DEFAULT_DOCUMENT_DESIGN,
  REPORT_PRINT_MODES,
  DEFAULT_REPORT_PRINT_MODE,
  SETTINGS_SECTION_KEYS,
  BRAND_LAYOUT_DEFAULTS,
  BRAND_LOGO_POSITIONS,
  BRAND_LAYOUT_LIMITS,
  MAX_BRAND_FOOTER_TEXT_LENGTH,
  MARKSHEET_FIELD_KEYS,
  ADMIT_CARD_FIELD_KEYS,
  MAX_ID_CARD_BACK_TITLE_LENGTH,
  MAX_ID_CARD_BACK_LOST_TEXT_LENGTH,
} from "./settings.constants";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

/** Clamped number-or-undefined: returns undefined (leave untouched) when the
 * input itself is undefined, throws on anything that isn't a finite number
 * in range, otherwise the parsed number. */
function parseBoundedNumber(
  value: number | string | undefined,
  limits: { min: number; max: number },
  label: string,
): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < limits.min || n > limits.max) {
    throw new BadRequestError(`Invalid ${label} (expected ${limits.min}-${limits.max})`);
  }
  return n;
}

/** Merges a partial UpdateBrandLayoutRequestDto onto the madrasa's existing
 * (already-defaults-filled) brand layout, validating each provided field.
 * Returns undefined when the caller sent no report_brand_layout at all, so
 * the surrounding updateBranding() call can skip touching the column. */
function mergeBrandLayoutPatch(
  existing: BrandLayoutData,
  patch: UpdateBrandLayoutRequestDto | undefined,
): BrandLayoutData | undefined {
  if (!patch) return undefined;

  const next: BrandLayoutData = { ...existing };

  const nameFontSize = parseBoundedNumber(
    patch.name_font_size,
    BRAND_LAYOUT_LIMITS.name_font_size,
    "name_font_size",
  );
  if (nameFontSize !== undefined) next.name_font_size = nameFontSize;

  if (patch.name_color !== undefined) {
    if (patch.name_color !== null && !isValidHexColor(patch.name_color)) {
      throw new BadRequestError("Invalid name_color");
    }
    next.name_color = patch.name_color || BRAND_LAYOUT_DEFAULTS.name_color;
  }

  const addressFontSize = parseBoundedNumber(
    patch.address_font_size,
    BRAND_LAYOUT_LIMITS.address_font_size,
    "address_font_size",
  );
  if (addressFontSize !== undefined) next.address_font_size = addressFontSize;

  if (patch.address_color !== undefined) {
    if (patch.address_color !== null && !isValidHexColor(patch.address_color)) {
      throw new BadRequestError("Invalid address_color");
    }
    next.address_color = patch.address_color || BRAND_LAYOUT_DEFAULTS.address_color;
  }

  const logoSize = parseBoundedNumber(patch.logo_size, BRAND_LAYOUT_LIMITS.logo_size, "logo_size");
  if (logoSize !== undefined) next.logo_size = logoSize;

  if (patch.logo_position !== undefined) {
    if (!(BRAND_LOGO_POSITIONS as readonly string[]).includes(patch.logo_position)) {
      throw new BadRequestError("Invalid logo_position");
    }
    next.logo_position = patch.logo_position as BrandLayoutData["logo_position"];
  }

  const logoOffsetX = parseBoundedNumber(
    patch.logo_offset_x,
    BRAND_LAYOUT_LIMITS.logo_offset_x,
    "logo_offset_x",
  );
  if (logoOffsetX !== undefined) next.logo_offset_x = logoOffsetX;

  const logoOffsetY = parseBoundedNumber(
    patch.logo_offset_y,
    BRAND_LAYOUT_LIMITS.logo_offset_y,
    "logo_offset_y",
  );
  if (logoOffsetY !== undefined) next.logo_offset_y = logoOffsetY;

  if (patch.header_height !== undefined) {
    if (patch.header_height === null || patch.header_height === "") {
      next.header_height = null; // back to auto
    } else {
      next.header_height = parseBoundedNumber(
        patch.header_height,
        BRAND_LAYOUT_LIMITS.header_height,
        "header_height",
      )!;
    }
  }

  if (patch.footer_text !== undefined) {
    if (patch.footer_text !== null && typeof patch.footer_text !== "string") {
      throw new BadRequestError("Invalid footer_text");
    }
    if (typeof patch.footer_text === "string" && patch.footer_text.length > MAX_BRAND_FOOTER_TEXT_LENGTH) {
      throw new BadRequestError("footer_text is too long");
    }
    next.footer_text = patch.footer_text?.trim() || null;
  }

  const footerFontSize = parseBoundedNumber(
    patch.footer_font_size,
    BRAND_LAYOUT_LIMITS.footer_font_size,
    "footer_font_size",
  );
  if (footerFontSize !== undefined) next.footer_font_size = footerFontSize;

  if (patch.footer_color !== undefined) {
    if (patch.footer_color !== null && !isValidHexColor(patch.footer_color)) {
      throw new BadRequestError("Invalid footer_color");
    }
    next.footer_color = patch.footer_color || BRAND_LAYOUT_DEFAULTS.footer_color;
  }

  const footerHeight = parseBoundedNumber(
    patch.footer_height,
    BRAND_LAYOUT_LIMITS.footer_height,
    "footer_height",
  );
  if (footerHeight !== undefined) next.footer_height = footerHeight;

  return next;
}

const SIGNATURE_POSITIONS = ["left", "center", "right"] as const;

/** Keeps a valid `position` on the sig_* keys only (info fields ignore it). */
function withSignaturePosition(item: MarksheetFieldItem, position: unknown): MarksheetFieldItem {
  if (!item.key.startsWith("sig_")) return item;
  if (!(SIGNATURE_POSITIONS as readonly unknown[]).includes(position)) return item;
  return { ...item, position: position as MarksheetFieldItem["position"] };
}

/** Validates + normalizes a full marksheet_fields replacement (not a partial
 * patch - the client always resends the whole ordered list, same as the
 * document designer's layer arrays). Drops nothing silently on a malformed
 * shape (throws instead, same strictness as sanitizeContactList below) but
 * DOES silently append any known field key the caller's list left out, at
 * the end, visible by default - so a field added to MARKSHEET_FIELD_KEYS
 * after a tenant already customized their order never just disappears from
 * the print. Returns undefined when the caller sent nothing at all. */
function sanitizeMarksheetFields(
  value: UpdateBrandingRequestDto["marksheet_fields"],
): MarksheetFieldItem[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BadRequestError("Invalid marksheet_fields");

  const seen = new Set<string>();
  const cleaned: MarksheetFieldItem[] = [];
  for (const item of value) {
    const key = item && typeof item === "object" ? (item as { key?: unknown }).key : undefined;
    if (typeof key !== "string" || !(MARKSHEET_FIELD_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestError("Invalid marksheet field key");
    }
    if (seen.has(key)) throw new BadRequestError("Duplicate marksheet field key");
    seen.add(key);
    cleaned.push(
      withSignaturePosition(
        { key, visible: !!(item as { visible?: unknown }).visible },
        (item as { position?: unknown }).position,
      ),
    );
  }

  for (const key of MARKSHEET_FIELD_KEYS) {
    if (!seen.has(key)) cleaned.push({ key, visible: true });
  }

  return cleaned;
}

/** Read-side counterpart: fills in any known field missing from what's
 * stored (same reasoning as sanitizeMarksheetFields' own fill-in) without
 * throwing, since this runs against our own DB data on every getBranding()
 * call rather than fresh user input. */
function fillMarksheetFields(stored: unknown): MarksheetFieldItem[] {
  const list = Array.isArray(stored) ? (stored as Partial<MarksheetFieldItem>[]) : [];
  const seen = new Set<string>();
  const cleaned: MarksheetFieldItem[] = [];
  for (const item of list) {
    const key = item?.key;
    if (typeof key !== "string" || seen.has(key) || !(MARKSHEET_FIELD_KEYS as readonly string[]).includes(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(withSignaturePosition({ key, visible: !!item?.visible }, item?.position));
  }
  for (const key of MARKSHEET_FIELD_KEYS) {
    if (!seen.has(key)) cleaned.push({ key, visible: true });
  }
  return cleaned;
}

/** Validates + normalizes a full admit_card_fields replacement - same
 * "always resend the whole ordered list" contract as sanitizeMarksheetFields,
 * minus the signature-position handling (this design has one fixed
 * signature line, not user-togglable). Returns undefined when the caller
 * sent nothing at all. */
function sanitizeAdmitCardFields(
  value: UpdateBrandingRequestDto["admit_card_fields"],
): AdmitCardFieldItem[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BadRequestError("Invalid admit_card_fields");

  const seen = new Set<string>();
  const cleaned: AdmitCardFieldItem[] = [];
  for (const item of value) {
    const key = item && typeof item === "object" ? (item as { key?: unknown }).key : undefined;
    if (typeof key !== "string" || !(ADMIT_CARD_FIELD_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestError("Invalid admit card field key");
    }
    if (seen.has(key)) throw new BadRequestError("Duplicate admit card field key");
    seen.add(key);
    cleaned.push({ key, visible: !!(item as { visible?: unknown }).visible });
  }

  for (const key of ADMIT_CARD_FIELD_KEYS) {
    if (!seen.has(key)) cleaned.push({ key, visible: true });
  }

  return cleaned;
}

/** Read-side counterpart: fills in any known field missing from what's
 * stored, without throwing (same reasoning as fillMarksheetFields). */
function fillAdmitCardFields(stored: unknown): AdmitCardFieldItem[] {
  const list = Array.isArray(stored) ? (stored as Partial<AdmitCardFieldItem>[]) : [];
  const seen = new Set<string>();
  const cleaned: AdmitCardFieldItem[] = [];
  for (const item of list) {
    const key = item?.key;
    if (typeof key !== "string" || seen.has(key) || !(ADMIT_CARD_FIELD_KEYS as readonly string[]).includes(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push({ key, visible: !!item?.visible });
  }
  for (const key of ADMIT_CARD_FIELD_KEYS) {
    if (!seen.has(key)) cleaned.push({ key, visible: true });
  }
  return cleaned;
}

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

const WHATSAPP_NUMBER_RE = /^\+?[0-9০-৯][0-9০-৯\s-]{5,19}$/;
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;

/** Validates + normalizes a full social_links replacement list. WhatsApp
 * entries hold a phone number, every other type an http(s) URL (a bare
 * "facebook.com/..." gets https:// prepended). Blank rows are dropped;
 * anything else malformed throws. Returns undefined when nothing was sent. */
function sanitizeSocialLinks(value: UpdateBrandingRequestDto["social_links"]): SocialLinkItem[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BadRequestError("Invalid social_links");
  if (value.length > MAX_SOCIAL_LINKS) throw new BadRequestError(`At most ${MAX_SOCIAL_LINKS} social links allowed`);

  const cleaned: SocialLinkItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") throw new BadRequestError("Invalid social link");
    const { type, label, value: raw } = item;
    if (typeof type !== "string" || !(SOCIAL_LINK_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestError("Invalid social link type");
    }
    if (raw !== undefined && raw !== null && typeof raw !== "string") throw new BadRequestError("Invalid social link");
    if (label !== undefined && label !== null && typeof label !== "string") {
      throw new BadRequestError("Invalid social link label");
    }

    let link = (raw ?? "").trim();
    if (!link) continue;
    if (link.length > MAX_SOCIAL_LINK_VALUE_LENGTH) throw new BadRequestError("Social link is too long");

    if (type === "whatsapp") {
      if (!WHATSAPP_NUMBER_RE.test(link)) throw new BadRequestError("Invalid WhatsApp number");
    } else {
      if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
      if (!HTTP_URL_RE.test(link)) throw new BadRequestError("Invalid social link URL");
    }

    const cleanLabel = (label ?? "").trim();
    if (cleanLabel.length > MAX_SOCIAL_LINK_LABEL_LENGTH) throw new BadRequestError("Social link label is too long");
    cleaned.push({ type, label: cleanLabel || null, value: link });
  }
  return cleaned;
}

/** Read-side counterpart: silently drops anything malformed in stored data. */
function fillSocialLinks(stored: unknown): SocialLinkItem[] {
  if (!Array.isArray(stored)) return [];
  return (stored as Partial<SocialLinkItem>[])
    .filter(
      (item) =>
        typeof item?.type === "string" &&
        (SOCIAL_LINK_TYPES as readonly string[]).includes(item.type) &&
        typeof item.value === "string" &&
        item.value.trim() !== "",
    )
    .map((item) => ({ type: item.type!, label: item.label ?? null, value: item.value! }));
}

const ISO_DATE_RE =/^d{4}-d{2}-d{2}$/;

const EMPTY_ID_CARD_BACK: IdCardBackData = {
  issue_date: null,
  expiry_date: null,
  principal_title: null,
  principal_signature: null,
  lost_return_text: null,
  default_design_id: null,
};

const isValidIsoDate = (value: unknown): value is string =>
  typeof value === "string" && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));

const toBoolInt = (value: unknown): 0 | 1 => (Number(value) ? 1 : 0);

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
      social_links: fillSocialLinks(madrasa.brandingSocialLinks),
      report_logo: madrasa.reportLogo,
      report_banner: madrasa.reportBanner,
      report_watermark: madrasa.reportWatermark,
      report_watermark_opacity: Number(madrasa.reportWatermarkOpacity),
      report_header_footer_enabled: !!madrasa.reportHeaderFooterEnabled,
      report_header_image: madrasa.reportHeaderImage,
      report_footer_image: madrasa.reportFooterImage,
      report_print_mode: madrasa.reportPrintMode || DEFAULT_REPORT_PRINT_MODE,
      report_brand_layout: {
        ...BRAND_LAYOUT_DEFAULTS,
        ...((madrasa.reportBrandLayout as Partial<BrandLayoutData> | null) || {}),
      },
      marksheet_fields: fillMarksheetFields(madrasa.marksheetFieldLayout),
      admit_card_fields: fillAdmitCardFields(madrasa.admitCardFieldLayout),
    };
  }

  async updateBranding(madrasaId: number, userId: number, body: UpdateBrandingRequestDto) {
    const {
      name,
      address,
      phones,
      emails,
      social_links,
      report_logo,
      report_banner,
      report_watermark,
      report_watermark_opacity,
      report_header_footer_enabled,
      report_header_image,
      report_footer_image,
      report_print_mode,
      report_brand_layout,
      marksheet_fields,
      admit_card_fields,
    } = body;

    for (const [key, value] of Object.entries({
      report_logo,
      report_banner,
      report_watermark,
      report_header_image,
      report_footer_image,
    })) {
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

    const cleanedSocialLinks = sanitizeSocialLinks(social_links);

    let opacity: number | undefined;
    if (report_watermark_opacity !== undefined && report_watermark_opacity !== null) {
      opacity = Number(report_watermark_opacity);
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        throw new BadRequestError("Watermark opacity must be between 0 and 1");
      }
    }

    if (
      report_print_mode !== undefined &&
      !(REPORT_PRINT_MODES as readonly string[]).includes(report_print_mode)
    ) {
      throw new BadRequestError("Invalid report print mode");
    }

    // Fetched unconditionally (not just for report_brand_layout, as before)
    // so the activity-log diff below always has a "before" snapshot to
    // compare each provided field against.
    const current = await this.repository.findBranding(madrasaId);

    let mergedBrandLayout: BrandLayoutData | undefined;
    if (report_brand_layout !== undefined) {
      const existingLayout: BrandLayoutData = {
        ...BRAND_LAYOUT_DEFAULTS,
        ...((current?.reportBrandLayout as Partial<BrandLayoutData> | null) || {}),
      };
      mergedBrandLayout = mergeBrandLayoutPatch(existingLayout, report_brand_layout);
    }

    const sanitizedMarksheetFields = sanitizeMarksheetFields(marksheet_fields);
    const sanitizedAdmitCardFields = sanitizeAdmitCardFields(admit_card_fields);

    const changes: string[] = [];
    if (name !== undefined && String(name).trim() !== "" && current && name !== current.name) {
      changes.push(`নাম: ${current.name ?? "—"} → ${name}`);
    }
    if (address !== undefined && current && address !== current.address) {
      changes.push(`ঠিকানা: ${current.address ?? "—"} → ${address ?? "—"}`);
    }
    if (cleanedPhones !== undefined && current) {
      const before = (current.brandingPhones || []).join(", ") || "—";
      const after = cleanedPhones.join(", ") || "—";
      if (before !== after) changes.push(`ফোন নম্বর: ${before} → ${after}`);
    }
    if (cleanedEmails !== undefined && current) {
      const before = (current.brandingEmails || []).join(", ") || "—";
      const after = cleanedEmails.join(", ") || "—";
      if (before !== after) changes.push(`ইমেইল: ${before} → ${after}`);
    }
    if (cleanedSocialLinks !== undefined && current) {
      const fmt = (list: SocialLinkItem[]) => list.map((l) => `${l.type}: ${l.value}`).join(", ") || "—";
      const before = fmt(fillSocialLinks(current.brandingSocialLinks));
      const after = fmt(cleanedSocialLinks);
      if (before !== after) changes.push(`সোশ্যাল লিংক: ${before} → ${after}`);
    }
    const imageLabels: Record<string, string> = {
      report_logo: "লোগো",
      report_banner: "ব্যানার",
      report_watermark: "ওয়াটারমার্ক",
      report_header_image: "কাস্টম হেডার ছবি",
      report_footer_image: "কাস্টম ফুটার ছবি",
    };
    for (const [key, label] of Object.entries(imageLabels)) {
      const value = (body as Record<string, unknown>)[key];
      if (value !== undefined && value !== null) changes.push(`${label} পরিবর্তন করা হয়েছে`);
    }
    if (opacity !== undefined && current && opacity !== Number(current.reportWatermarkOpacity)) {
      changes.push(`ওয়াটারমার্কের স্বচ্ছতা: ${current.reportWatermarkOpacity} → ${opacity}`);
    }
    if (
      report_header_footer_enabled !== undefined &&
      current &&
      toBoolInt(report_header_footer_enabled) !== toBoolInt(current.reportHeaderFooterEnabled)
    ) {
      changes.push(
        `কাস্টম হেডার/ফুটার: ${current.reportHeaderFooterEnabled ? "চালু" : "বন্ধ"} → ${report_header_footer_enabled ? "চালু" : "বন্ধ"}`,
      );
    }
    if (report_print_mode !== undefined && current && report_print_mode !== current.reportPrintMode) {
      changes.push(`প্রিন্ট মোড: ${current.reportPrintMode || DEFAULT_REPORT_PRINT_MODE} → ${report_print_mode}`);
    }
    if (mergedBrandLayout !== undefined) changes.push("রিপোর্ট লেআউট (ফন্ট/রঙ/অবস্থান) আপডেট করা হয়েছে");
    if (sanitizedMarksheetFields !== undefined) changes.push("মার্কশিট তথ্য ফিল্ড আপডেট করা হয়েছে");
    if (sanitizedAdmitCardFields !== undefined) changes.push("প্রবেশপত্র তথ্য ফিল্ড আপডেট করা হয়েছে");

    await this.repository.updateBranding(madrasaId, {
      // COALESCE(NULLIF(?, ''), name): only overwrite if a non-empty name given
      ...(name !== undefined && String(name).trim() !== "" ? { name } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(cleanedPhones !== undefined ? { brandingPhones: { set: cleanedPhones } } : {}),
      ...(cleanedEmails !== undefined ? { brandingEmails: { set: cleanedEmails } } : {}),
      ...(cleanedSocialLinks !== undefined
        ? { brandingSocialLinks: cleanedSocialLinks as unknown as Prisma.InputJsonValue }
        : {}),
      ...(report_logo !== undefined && report_logo !== null
        ? { reportLogo: storageProvider.persistImage(report_logo) }
        : {}),
      ...(report_banner !== undefined && report_banner !== null
        ? { reportBanner: storageProvider.persistImage(report_banner) }
        : {}),
      ...(report_watermark !== undefined && report_watermark !== null
        ? { reportWatermark: storageProvider.persistImage(report_watermark) }
        : {}),
      ...(report_header_image !== undefined && report_header_image !== null
        ? { reportHeaderImage: storageProvider.persistImage(report_header_image) }
        : {}),
      ...(report_footer_image !== undefined && report_footer_image !== null
        ? { reportFooterImage: storageProvider.persistImage(report_footer_image) }
        : {}),
      // Only touch opacity when the caller actually sent it - each field is
      // now saved independently (inline edit UI), so a save of e.g. just the
      // name must not silently reset this back to DEFAULT_WATERMARK_OPACITY.
      ...(opacity !== undefined ? { reportWatermarkOpacity: opacity } : {}),
      ...(report_header_footer_enabled !== undefined
        ? { reportHeaderFooterEnabled: toBoolInt(report_header_footer_enabled) }
        : {}),
      ...(report_print_mode !== undefined ? { reportPrintMode: report_print_mode } : {}),
      ...(mergedBrandLayout !== undefined
        ? { reportBrandLayout: mergedBrandLayout as unknown as Prisma.InputJsonValue }
        : {}),
      ...(sanitizedMarksheetFields !== undefined
        ? { marksheetFieldLayout: sanitizedMarksheetFields as unknown as Prisma.InputJsonValue }
        : {}),
      ...(sanitizedAdmitCardFields !== undefined
        ? { admitCardFieldLayout: sanitizedAdmitCardFields as unknown as Prisma.InputJsonValue }
        : {}),
    });

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "UPDATE",
      entity: "settings/branding",
      details: `ব্র্যান্ডিং সেটিংস আপডেট করা হয়েছে — ${changes.length ? changes.join(", ") : "কোনো পরিবর্তন নেই"}`,
    });
  }

  async deleteBrandingImage(madrasaId: number, userId: number, field: string) {
    const mapped = BRANDING_IMAGE_FIELDS[field];
    if (!mapped) throw new BadRequestError("Invalid field");

    await this.repository.updateField(madrasaId, mapped, null);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "DELETE",
      entity: "settings/branding",
      details: `ব্র্যান্ডিং সেটিংসের ছবি মুছে ফেলা হয়েছে — ফিল্ড: ${field}`,
    });
  }

  async getDocumentTemplates(madrasaId: number): Promise<DocumentTemplatesData> {
    const madrasa = await this.repository.findDocumentTemplates(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    return {
      sanad_template: madrasa.sanadTemplate,
      testimonial_template: madrasa.testimonialTemplate,
      transfer_letter_template: madrasa.transferLetterTemplate,
      admit_card_rules: madrasa.admitCardRules,
      custom_notice_template: madrasa.customNoticeTemplate,
      tokens: TEMPLATE_TOKENS,
    };
  }

  async updateDocumentTemplates(madrasaId: number, body: UpdateDocumentTemplatesRequestDto) {
    const {
      sanad_template,
      testimonial_template,
      transfer_letter_template,
      admit_card_rules,
      custom_notice_template,
    } = body;

    for (const [key, value] of Object.entries({
      sanad_template,
      testimonial_template,
      transfer_letter_template,
      admit_card_rules,
      custom_notice_template,
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
      ...(custom_notice_template !== undefined ? { customNoticeTemplate: custom_notice_template } : {}),
    });
  }

  async getIdCardBack(madrasaId: number): Promise<IdCardBackData> {
    const madrasa = await this.repository.findIdCardBack(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    return {
      ...EMPTY_ID_CARD_BACK,
      ...((madrasa.idCardBackSettings as Partial<IdCardBackData> | null) || {}),
    };
  }

  async updateIdCardBack(madrasaId: number, body: UpdateIdCardBackRequestDto) {
    const { issue_date, expiry_date, principal_title, principal_signature, lost_return_text, default_design_id } = body;

    for (const [label, value] of [
      ["issue_date", issue_date],
      ["expiry_date", expiry_date],
    ] as const) {
      if (value !== undefined && value !== null && !isValidIsoDate(value)) {
        throw new BadRequestError(`Invalid ${label} (expected YYYY-MM-DD)`);
      }
    }
    if (principal_title !== undefined && !isValidTextValue(principal_title, MAX_ID_CARD_BACK_TITLE_LENGTH)) {
      throw new BadRequestError("Invalid principal_title");
    }
    if (lost_return_text !== undefined && !isValidTextValue(lost_return_text, MAX_ID_CARD_BACK_LOST_TEXT_LENGTH)) {
      throw new BadRequestError("Invalid lost_return_text");
    }
    if (principal_signature !== undefined && !storageProvider.isValidImage(principal_signature)) {
      throw new BadRequestError("Invalid image for principal_signature");
    }
    if (default_design_id !== undefined && default_design_id !== null && !Number.isInteger(default_design_id)) {
      throw new BadRequestError("Invalid default_design_id");
    }

    const current = await this.getIdCardBack(madrasaId);
    const next: IdCardBackData = {
      ...current,
      ...(issue_date !== undefined ? { issue_date } : {}),
      ...(expiry_date !== undefined ? { expiry_date } : {}),
      ...(principal_title !== undefined ? { principal_title } : {}),
      ...(lost_return_text !== undefined ? { lost_return_text } : {}),
      ...(default_design_id !== undefined ? { default_design_id } : {}),
      ...(principal_signature !== undefined
        ? {
            principal_signature:
              principal_signature === null ? null : storageProvider.persistImage(principal_signature),
          }
        : {}),
    };

    if (next.issue_date && next.expiry_date && next.expiry_date < next.issue_date) {
      throw new BadRequestError("expiry_date cannot be before issue_date");
    }

    await this.repository.updateIdCardBack(madrasaId, {
      idCardBackSettings: next as unknown as Prisma.InputJsonValue,
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

  async getSectionToggles(madrasaId: number): Promise<SectionTogglesData> {
    const madrasa = await this.repository.findSectionToggles(madrasaId);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    const stored = (madrasa.settingsSectionToggles as Record<string, boolean> | null) || {};
    const result: SectionTogglesData = {};
    for (const key of SETTINGS_SECTION_KEYS) {
      result[key] = stored[key] !== undefined ? !!stored[key] : true;
    }
    return result;
  }

  async updateSectionToggle(madrasaId: number, body: UpdateSectionToggleRequestDto) {
    const { key, enabled } = body;
    if (!key || !(SETTINGS_SECTION_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestError("Invalid section key");
    }

    const current = await this.getSectionToggles(madrasaId);
    current[key] = toBoolInt(enabled) === 1;
    await this.repository.updateSectionToggles(madrasaId, current);
    return current;
  }
}

export const settingsService = new SettingsService();
