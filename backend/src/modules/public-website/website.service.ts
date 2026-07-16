import { Request } from "express";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { websiteRepository, WebsiteRepository } from "./website.repository";
import {
  SaveWebsiteGalleryItemRequestDto,
  SaveWebsiteNoticeRequestDto,
  UpsertWebsitePageRequestDto,
  UpsertWebsiteSettingsRequestDto,
} from "./website.dto";
import { DEFAULT_THEME_COLOR, VALID_WEBSITE_STATUSES } from "./website.constants";

export const resolveTenantId = (req: Request): number =>
  Number((req as any).tenant?.madrasa_id || req.body.madrasa_id || req.query.madrasa_id);

const boolValue = (value: unknown, fallback = 1) => {
  if (value === undefined || value === null || value === "") return fallback;
  return Number(value) ? 1 : 0;
};

export class WebsiteService {
  constructor(private readonly repository: WebsiteRepository = websiteRepository) {}

  async getPublicWebsite(slug: string) {
    const madrasa = await this.repository.findPublicMadrasaBySlug(slug);
    if (!madrasa) throw new NotFoundError("Madrasa not found");

    if (!madrasa.isActive || madrasa.websiteStatus === "disabled") {
      throw new ForbiddenError("This website is currently disabled");
    }

    const settings = await this.repository.findSettings(madrasa.id);
    if (settings?.isPublished === 0) {
      throw new ForbiddenError("This website is not published yet");
    }

    const [pages, notices, teachers, gallery] = await Promise.all([
      this.repository.findPublishedPages(madrasa.id),
      this.repository.findPublishedNotices(madrasa.id),
      this.repository.findTeachersOptional(madrasa.id),
      this.repository.findPublishedGallery(madrasa.id),
    ]);

    return { madrasa, settings: settings || {}, pages, notices, teachers, gallery };
  }

  async getWebsiteSettings(madrasaId: number) {
    const [madrasa, settings, pages, notices, gallery] = await Promise.all([
      this.repository.findMadrasaForAdmin(madrasaId),
      this.repository.findSettings(madrasaId),
      this.repository.findAllPages(madrasaId),
      this.repository.findAllNotices(madrasaId),
      this.repository.findAllGallery(madrasaId),
    ]);

    return {
      madrasa: madrasa || null,
      settings: settings || null,
      pages,
      notices,
      gallery,
    };
  }

  async upsertWebsiteSettings(madrasaId: number, body: UpsertWebsiteSettingsRequestDto) {
    const {
      name,
      phone,
      email,
      address,
      logo_url,
      hero_title,
      hero_subtitle,
      theme_color,
      show_notices,
      show_gallery,
      show_teachers,
      show_admission,
      show_about,
      show_contact,
      is_published,
    } = body;

    await this.repository.updateMadrasaContactInfo(madrasaId, {
      ...(name ? { name } : {}),
      phone: phone || null,
      email: email || null,
      address: address || null,
    });

    const shared = {
      logoUrl: logo_url || null,
      heroTitle: hero_title || null,
      heroSubtitle: hero_subtitle || null,
      themeColor: theme_color || DEFAULT_THEME_COLOR,
      showNotices: boolValue(show_notices),
      showGallery: boolValue(show_gallery),
      showTeachers: boolValue(show_teachers),
      showAdmission: boolValue(show_admission),
      showAbout: boolValue(show_about),
      showContact: boolValue(show_contact),
      isPublished: boolValue(is_published),
    };

    await this.repository.upsertSettings(madrasaId, shared, { madrasaId, ...shared });
  }

  async upsertWebsitePage(madrasaId: number, body: UpsertWebsitePageRequestDto) {
    const { page_key, title, content, is_published = 1, sort_order = 0 } = body;
    if (!page_key || !title) throw new BadRequestError("page_key and title required");

    const shared = {
      title,
      content: content || null,
      isPublished: boolValue(is_published),
      sortOrder: Number(sort_order) || 0,
    };

    await this.repository.upsertPage(madrasaId, page_key, shared, {
      madrasaId,
      pageKey: page_key,
      ...shared,
    });
  }

  async saveWebsiteNotice(madrasaId: number, body: SaveWebsiteNoticeRequestDto) {
    const { id, title, content, is_published = 1 } = body;
    if (!title) throw new BadRequestError("Notice title required");

    if (id) {
      await this.repository.updateNotice(Number(id), madrasaId, {
        title,
        content: content || null,
        isPublished: boolValue(is_published),
      });
    } else {
      await this.repository.createNotice({
        madrasaId,
        title,
        content: content || null,
        isPublished: boolValue(is_published),
      });
    }

    return this.repository.findLatestNotice(madrasaId);
  }

  async deleteWebsiteNotice(madrasaId: number, id: number) {
    await this.repository.deleteNotice(id, madrasaId);
  }

  async saveWebsiteGalleryItem(madrasaId: number, body: SaveWebsiteGalleryItemRequestDto) {
    const { id, title, image_url, is_published = 1, sort_order = 0 } = body;
    if (!image_url) throw new BadRequestError("Image URL required");

    if (id) {
      await this.repository.updateGalleryItem(Number(id), madrasaId, {
        title: title || null,
        imageUrl: image_url,
        isPublished: boolValue(is_published),
        sortOrder: Number(sort_order) || 0,
      });
    } else {
      await this.repository.createGalleryItem({
        madrasaId,
        title: title || null,
        imageUrl: image_url,
        isPublished: boolValue(is_published),
        sortOrder: Number(sort_order) || 0,
      });
    }

    return this.repository.findLatestGalleryItem(madrasaId);
  }

  async deleteWebsiteGalleryItem(madrasaId: number, id: number) {
    await this.repository.deleteGalleryItem(id, madrasaId);
  }

  async updateWebsiteStatusBySuperAdmin(id: number, status: string) {
    if (!(VALID_WEBSITE_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestError("Invalid website status");
    }
    await this.repository.updateWebsiteStatus(id, status);
    return status;
  }
}

export const websiteService = new WebsiteService();
