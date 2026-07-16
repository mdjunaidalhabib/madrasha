import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { PUBLIC_NOTICES_LIMIT, PUBLIC_TEACHERS_LIMIT, PUBLIC_GALLERY_LIMIT, ADMIN_NOTICES_LIMIT, ADMIN_GALLERY_LIMIT } from "./website.constants";

export class WebsiteRepository {
  findPublicMadrasaBySlug(slug: string) {
    return prisma.madrasa.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
        websiteStatus: true,
      },
    });
  }

  findSettings(madrasaId: number) {
    return prisma.websiteSettings.findUnique({ where: { madrasaId } });
  }

  findPublishedPages(madrasaId: number) {
    return prisma.websitePage.findMany({
      where: { madrasaId, isPublished: 1 },
      select: { pageKey: true, title: true, content: true, isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findPublishedNotices(madrasaId: number) {
    return prisma.websiteNotice.findMany({
      where: { madrasaId, isPublished: 1 },
      select: { id: true, title: true, content: true, publishedAt: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: PUBLIC_NOTICES_LIMIT,
    });
  }

  // Kept as a raw-query bridge (unchanged interface) since `teachers`
  // references columns diverging from the current schema - same
  // graceful-degrade (return [] on failure) behavior as before.
  async findTeachersOptional(madrasaId: number): Promise<any[]> {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, designation, subject FROM teachers WHERE madrasa_id=$1 ORDER BY id DESC LIMIT $2`,
        madrasaId,
        PUBLIC_TEACHERS_LIMIT,
      );
      return rows || [];
    } catch {
      return [];
    }
  }

  findPublishedGallery(madrasaId: number) {
    return prisma.websiteGallery.findMany({
      where: { madrasaId, isPublished: 1 },
      select: { id: true, title: true, imageUrl: true, isPublished: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { id: "desc" }],
      take: PUBLIC_GALLERY_LIMIT,
    });
  }

  findMadrasaForAdmin(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        email: true,
        address: true,
        websiteStatus: true,
      },
    });
  }

  findAllPages(madrasaId: number) {
    return prisma.websitePage.findMany({
      where: { madrasaId },
      select: { pageKey: true, title: true, content: true, isPublished: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findAllNotices(madrasaId: number) {
    return prisma.websiteNotice.findMany({
      where: { madrasaId },
      select: { id: true, title: true, content: true, isPublished: true, publishedAt: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: ADMIN_NOTICES_LIMIT,
    });
  }

  findAllGallery(madrasaId: number) {
    return prisma.websiteGallery.findMany({
      where: { madrasaId },
      select: { id: true, title: true, imageUrl: true, isPublished: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { id: "desc" }],
      take: ADMIN_GALLERY_LIMIT,
    });
  }

  updateMadrasaContactInfo(madrasaId: number, data: Prisma.MadrasaUpdateInput) {
    return prisma.madrasa.updateMany({ where: { id: madrasaId, deletedAt: null }, data });
  }

  upsertSettings(
    madrasaId: number,
    update: Prisma.WebsiteSettingsUpdateInput,
    create: Prisma.WebsiteSettingsUncheckedCreateInput,
  ) {
    return prisma.websiteSettings.upsert({ where: { madrasaId }, update, create });
  }

  upsertPage(
    madrasaId: number,
    pageKey: string,
    update: Prisma.WebsitePageUpdateInput,
    create: Prisma.WebsitePageUncheckedCreateInput,
  ) {
    return prisma.websitePage.upsert({
      where: { madrasaId_pageKey: { madrasaId, pageKey } },
      update,
      create,
    });
  }

  updateNotice(id: number, madrasaId: number, data: Prisma.WebsiteNoticeUpdateInput) {
    return prisma.websiteNotice.updateMany({ where: { id, madrasaId }, data });
  }

  createNotice(data: Prisma.WebsiteNoticeUncheckedCreateInput) {
    return prisma.websiteNotice.create({ data });
  }

  findLatestNotice(madrasaId: number) {
    return prisma.websiteNotice.findFirst({
      where: { madrasaId },
      select: { id: true, title: true, content: true, isPublished: true, publishedAt: true },
      orderBy: { id: "desc" },
    });
  }

  deleteNotice(id: number, madrasaId: number) {
    return prisma.websiteNotice.deleteMany({ where: { id, madrasaId } });
  }

  updateGalleryItem(id: number, madrasaId: number, data: Prisma.WebsiteGalleryUpdateInput) {
    return prisma.websiteGallery.updateMany({ where: { id, madrasaId }, data });
  }

  createGalleryItem(data: Prisma.WebsiteGalleryUncheckedCreateInput) {
    return prisma.websiteGallery.create({ data });
  }

  findLatestGalleryItem(madrasaId: number) {
    return prisma.websiteGallery.findFirst({
      where: { madrasaId },
      select: { id: true, title: true, imageUrl: true, isPublished: true, sortOrder: true },
      orderBy: { id: "desc" },
    });
  }

  deleteGalleryItem(id: number, madrasaId: number) {
    return prisma.websiteGallery.deleteMany({ where: { id, madrasaId } });
  }

  updateWebsiteStatus(id: number, status: string) {
    return prisma.madrasa.updateMany({ where: { id, deletedAt: null }, data: { websiteStatus: status } });
  }
}

export const websiteRepository = new WebsiteRepository();
