import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { vendorPromoRepository, VendorPromoRepository } from "./vendor-promo.repository";
import {
  CreateVendorServiceRequestDto,
  SaveVendorPromoConfigRequestDto,
  UpdateVendorServiceRequestDto,
} from "./vendor-promo.dto";

// Ship-with-sane-defaults so the card/page render something sensible even
// before a Super Admin has ever opened the settings page - every field
// stored in the DB is nullable, and a null/empty value falls back to these.
const DEFAULTS = {
  companyName: "Hikmah IT",
  tagline: "QMS ছাড়াও আমরা যা করে দিতে পারি",
  teaserText: "ওয়েবসাইট, ই-কমার্স প্ল্যাটফর্ম, হোস্টিং সহ আরও সেবা দিই আমরা।",
  detailLinkText: "বিস্তারিত দেখুন",
  heroTitle: "ই-কমার্স ও মাদরাসা ম্যানেজমেন্ট সফটওয়্যার",
  heroText:
    "আপনি এখন যে QMS ব্যবহার করছেন সেটি আমাদের তৈরি। এছাড়াও ব্যবসা ও শিক্ষা প্রতিষ্ঠানের জন্য ওয়েবসাইট, ই-কমার্স প্ল্যাটফর্ম ও আরও ডিজিটাল সমাধান দিয়ে থাকি — প্রয়োজন হলে নিচের তথ্য থেকে যোগাযোগ করুন।",
  founderName: "Md Junaid Al Habib",
  founderTitle: "প্রতিষ্ঠাতা ও সিইও",
  phoneDisplay: "01624114405",
  phoneIntl: "8801624114405",
  email: "hikmahitcenter@gmail.com",
  website: "https://hikmahit.com",
  address: "Jamalpur, Dhaka, Bangladesh",
};

const isEmpty = (value: unknown) => value === undefined || value === null || String(value).trim() === "";

export class VendorPromoService {
  constructor(private readonly repository: VendorPromoRepository = vendorPromoRepository) {}

  /** Admin-facing: the full config row, every field filled with a default
   * when unset, so the settings form always has something to show/edit. */
  async getConfig() {
    const row = await this.repository.findConfig();
    return {
      is_enabled: row?.isEnabled ?? true,
      company_name: row?.companyName || DEFAULTS.companyName,
      tagline: row?.tagline || DEFAULTS.tagline,
      teaser_text: row?.teaserText || DEFAULTS.teaserText,
      detail_link_text: row?.detailLinkText || DEFAULTS.detailLinkText,
      hero_title: row?.heroTitle || DEFAULTS.heroTitle,
      hero_text: row?.heroText || DEFAULTS.heroText,
      founder_name: row?.founderName || DEFAULTS.founderName,
      founder_title: row?.founderTitle || DEFAULTS.founderTitle,
      founder_location: row?.founderLocation || "",
      founder_bio: row?.founderBio || "",
      founder_skills: row?.founderSkills || "",
      founder_photo_url: row?.founderPhotoUrl || "",
      founder_facebook_url: row?.founderFacebookUrl || "",
      phone_display: row?.phoneDisplay || DEFAULTS.phoneDisplay,
      phone_intl: row?.phoneIntl || DEFAULTS.phoneIntl,
      email: row?.email || DEFAULTS.email,
      website: row?.website || DEFAULTS.website,
      address: row?.address || DEFAULTS.address,
    };
  }

  async saveConfig(dto: SaveVendorPromoConfigRequestDto) {
    const data: Prisma.PlatformVendorPromoUncheckedUpdateInput = {};
    if (dto.is_enabled !== undefined) data.isEnabled = Boolean(dto.is_enabled);
    if (dto.company_name !== undefined) data.companyName = dto.company_name.trim() || null;
    if (dto.tagline !== undefined) data.tagline = dto.tagline.trim() || null;
    if (dto.teaser_text !== undefined) data.teaserText = dto.teaser_text.trim() || null;
    if (dto.detail_link_text !== undefined) data.detailLinkText = dto.detail_link_text.trim() || null;
    if (dto.hero_title !== undefined) data.heroTitle = dto.hero_title.trim() || null;
    if (dto.hero_text !== undefined) data.heroText = dto.hero_text.trim() || null;
    if (dto.founder_name !== undefined) data.founderName = dto.founder_name.trim() || null;
    if (dto.founder_title !== undefined) data.founderTitle = dto.founder_title.trim() || null;
    if (dto.founder_location !== undefined) data.founderLocation = dto.founder_location.trim() || null;
    if (dto.founder_bio !== undefined) data.founderBio = dto.founder_bio.trim() || null;
    if (dto.founder_skills !== undefined) data.founderSkills = dto.founder_skills.trim() || null;
    if (dto.founder_photo_url !== undefined) data.founderPhotoUrl = dto.founder_photo_url.trim() || null;
    if (dto.founder_facebook_url !== undefined)
      data.founderFacebookUrl = dto.founder_facebook_url.trim() || null;
    if (dto.phone_display !== undefined) data.phoneDisplay = dto.phone_display.trim() || null;
    if (dto.phone_intl !== undefined) data.phoneIntl = dto.phone_intl.trim() || null;
    if (dto.email !== undefined) data.email = dto.email.trim() || null;
    if (dto.website !== undefined) data.website = dto.website.trim() || null;
    if (dto.address !== undefined) data.address = dto.address.trim() || null;

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");
    await this.repository.upsertConfig(data);
  }

  /** Tenant-facing: what the Dashboard promo card + HikmahItPage render.
   * `enabled: false` is the only field sent when a Super Admin has turned
   * the card off - callers must check that before reading anything else. */
  async getPublicPayload() {
    const config = await this.getConfig();
    if (!config.is_enabled) return { enabled: false as const };

    const services = await this.repository.findActiveServices();
    return {
      enabled: true as const,
      company_name: config.company_name,
      tagline: config.tagline,
      teaser_text: config.teaser_text,
      detail_link_text: config.detail_link_text,
      hero_title: config.hero_title,
      hero_text: config.hero_text,
      founder: {
        name: config.founder_name,
        title: config.founder_title,
        location: config.founder_location || null,
        bio: config.founder_bio || null,
        skills: config.founder_skills
          ? config.founder_skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        photo_url: config.founder_photo_url || null,
        facebook_url: config.founder_facebook_url || null,
      },
      contact: {
        phone_display: config.phone_display,
        phone_intl: config.phone_intl,
        email: config.email,
        website: config.website,
        address: config.address,
      },
      services: services.map((s) => ({
        id: s.id,
        label: s.label,
        desc: s.desc,
        icon_key: s.iconKey,
        is_current: s.isCurrent,
      })),
    };
  }

  /* ================= Services CRUD ================= */

  async listServices() {
    const rows = await this.repository.findServices();
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      desc: r.desc,
      icon_key: r.iconKey,
      is_current: r.isCurrent,
      is_active: r.isActive,
    }));
  }

  async createService(dto: CreateVendorServiceRequestDto) {
    if (isEmpty(dto.label)) throw new BadRequestError("label আবশ্যক");

    const maxOrder = await this.repository.findMaxServiceSortOrder();
    return this.repository.createService({
      label: String(dto.label).trim(),
      desc: dto.desc?.trim() || null,
      iconKey: dto.icon_key?.trim() || "Sparkles",
      isCurrent: Boolean(dto.is_current),
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    });
  }

  async updateService(id: number, dto: UpdateVendorServiceRequestDto) {
    const existing = await this.repository.findServiceById(id);
    if (!existing) throw new NotFoundError("সার্ভিস পাওয়া যায়নি");

    const data: Prisma.PlatformVendorServiceUpdateInput = {};
    if (dto.label !== undefined) {
      if (isEmpty(dto.label)) throw new BadRequestError("label খালি রাখা যাবে না");
      data.label = String(dto.label).trim();
    }
    if (dto.desc !== undefined) data.desc = dto.desc?.trim() || null;
    if (dto.icon_key !== undefined) data.iconKey = dto.icon_key?.trim() || "Sparkles";
    if (dto.is_current !== undefined) data.isCurrent = Boolean(dto.is_current);
    if (dto.is_active !== undefined) data.isActive = Boolean(dto.is_active);
    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    await this.repository.updateService(id, data);
  }

  async deleteService(id: number) {
    try {
      await this.repository.deleteService(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundError("সার্ভিস পাওয়া যায়নি");
      }
      throw err;
    }
  }

  async reorderServices(orderedIds: number[]) {
    const rows = await this.repository.findAllServiceIds();
    const allIds = rows.map((r) => r.id);
    const sameSet =
      allIds.length === orderedIds.length && allIds.every((id) => orderedIds.includes(id));
    if (!sameSet) throw new BadRequestError("service_ids must match every existing service exactly");

    await this.repository.reorderServices(orderedIds);
  }
}

export const vendorPromoService = new VendorPromoService();
