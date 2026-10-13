import { createHash } from "crypto";
import sharp from "sharp";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { decodeImageDataUri } from "../../shared/storage/image-processing";
import { prisma } from "../../shared/database/prisma";
import { logger } from "../../shared/logger/logger";
import { t } from "../../shared/i18n";
import { BRAND_ICON_SPECS, decodePreviewImage, renderBrandIcon, renderBrandIconPreviews } from "../public-website/brand-icon.service";

/**
 * Brand assets of the MAIN ADMIN PANEL, owned by the Super Admin
 * (table platform_brand_settings, one row at most).
 *
 * The logo saved here is the ONLY source of the admin panel's favicon,
 * apple-touch-icon and PWA icons. It is completely independent of every
 * madrasa's Branding Settings (madrasa.reportLogo) - this module never reads
 * or writes the madrasa table. No logo => no icon (404), never a default.
 */

/** Longest side of the stored master. The biggest icon is 512px, so 1024
 * leaves headroom without bloating the row. */
const MASTER_MAX_SIDE = 1024;

const notFound = () => new NotFoundError(t({ bn: "আইকন পাওয়া যায়নি", en: "Icon not found" }));

/** Short fingerprint of the stored logo - used as the cache-buster in every
 * icon URL, so a replaced or removed logo can never serve a stale icon. */
export const platformLogoVersion = (logo: string): string => createHash("sha1").update(logo).digest("hex").slice(0, 12);

const CACHE_LIMIT = 30;
const cache = new Map<string, Buffer>();
const remember = (key: string, png: Buffer) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, png);
};

const findRow = () => prisma.platformBrandSetting.findFirst({ orderBy: { id: "asc" } });

export const platformBrandService = {
  /** Super Admin view: the stored master (for the preview) + its version. */
  async getAdminLogo() {
    const row = await findRow();
    const logo = row?.adminLogo || null;
    if (!logo) return { configured: false as const };
    return {
      configured: true as const,
      logo,
      version: platformLogoVersion(logo),
      updated_at: row!.updatedAt,
    };
  },

  /** Accepts an uploaded image (base64 data URI), normalises it to a PNG
   * master and stores it. Replaces any previous logo. */
  async saveAdminLogo(image: unknown) {
    if (typeof image !== "string" || !image.trim()) {
      throw new BadRequestError(t({ bn: "লোগো ছবি আবশ্যক", en: "A logo image is required" }));
    }
    const input = decodeImageDataUri(image.trim());

    let png: Buffer;
    try {
      // density: crisp rasterisation for SVG logos; no effect on bitmaps.
      png = await sharp(input, { limitInputPixels: 50_000_000, density: 300 })
        .rotate()
        .resize({ width: MASTER_MAX_SIDE, height: MASTER_MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch {
      throw new BadRequestError(t({ bn: "ছবিটি পড়া যায়নি, অন্য ছবি দিন", en: "Could not read the image, please try another one" }));
    }
    const logo = `data:image/png;base64,${png.toString("base64")}`;

    const existing = await findRow();
    if (existing) {
      await prisma.platformBrandSetting.update({ where: { id: existing.id }, data: { adminLogo: logo } });
    } else {
      await prisma.platformBrandSetting.create({ data: { adminLogo: logo } });
    }
    return this.getAdminLogo();
  },

  async deleteAdminLogo() {
    const existing = await findRow();
    if (existing) await prisma.platformBrandSetting.update({ where: { id: existing.id }, data: { adminLogo: null } });
    cache.clear();
  },

  /** Super Admin: every icon the given (not yet saved) logo would produce, so
   * the person can check them before pressing Save. Nothing is stored. */
  async previewIcons(image: unknown) {
    const input = decodePreviewImage(image);
    try {
      return { icons: await renderBrandIconPreviews(input) };
    } catch {
      throw new BadRequestError(t({ bn: "ছবিটি পড়া যায়নি, অন্য ছবি দিন", en: "Could not read the image, please try another one" }));
    }
  },

  /** Public: just the version - null means "no logo, show no icon". */
  async getPublicInfo() {
    const row = await findRow();
    const logo = row?.adminLogo || null;
    return { version: logo ? platformLogoVersion(logo) : null };
  },

  /** Public: the rendered PNG for `file`; NotFoundError when no logo is set. */
  async getIcon(file: string): Promise<Buffer> {
    if (!BRAND_ICON_SPECS[file]) throw notFound();

    const row = await findRow();
    const logo = row?.adminLogo || null;
    if (!logo) throw notFound();

    const key = `${file}:${platformLogoVersion(logo)}`;
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      const png = await renderBrandIcon(decodeImageDataUri(logo), file);
      remember(key, png);
      return png;
    } catch (err) {
      logger.warn("[platform-brand] could not render icon", { file, error: (err as Error)?.message });
      throw notFound();
    }
  },
};
