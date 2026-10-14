import { createHash } from "crypto";
import dns from "dns/promises";
import net from "net";
import sharp from "sharp";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { decodeImageDataUri } from "../../shared/storage/image-processing";
import { r2CredentialsFromEnv } from "../../shared/storage/r2.service";
import { prisma } from "../../shared/database/prisma";
import { logger } from "../../shared/logger/logger";
import { t } from "../../shared/i18n";

/**
 * Favicon / PWA icons for a madrasa, generated on the fly from the logo the
 * admin set in Branding Settings (madrasa.reportLogo). No logo => 404, i.e.
 * the madrasa simply has no icon - there is deliberately no platform default.
 *
 * File names mirror what browsers/PWA manifests expect so the frontends only
 * need to point their <link>/manifest entries at
 *   /api/website/public/:slug/icon/<file>
 */
type IconKind = "any" | "solid" | "maskable";
interface IconSpec {
  size: number;
  kind: IconKind;
}

export const BRAND_ICON_SPECS: Record<string, IconSpec> = {
  // browser tab - transparent, logo fills the square
  "favicon-32.png": { size: 32, kind: "any" },
  // iOS paints transparency black, so it gets a white tile + a little padding
  "apple-touch-icon.png": { size: 180, kind: "solid" },
  // manifest "any" icons - transparent, logo fills the square
  "icon-192.png": { size: 192, kind: "any" },
  "icon-512.png": { size: 512, kind: "any" },
  // manifest "maskable" - logo fills the full ~80% safe zone on a white tile,
  // so Android's circle/squircle masks never crop it
  "maskable-512.png": { size: 512, kind: "maskable" },
};

const FETCH_TIMEOUT_MS = 6000;
const MAX_REMOTE_BYTES = 10 * 1024 * 1024;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/* ---------- logo source loading ---------- */

const isPrivateAddress = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  return true;
};

/** Logos uploaded through the app live on our own R2 bucket; any other
 * https URL is still accepted (the branding API allows it) but is only
 * fetched when it does not point at an internal address. */
const assertSafeRemoteUrl = async (raw: string): Promise<URL> => {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("only https logos can be fetched");

  const r2 = r2CredentialsFromEnv();
  if (r2 && raw.startsWith(r2.publicUrl.replace(/\/+$/, "") + "/")) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("logo host is not allowed");
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("logo host is not allowed");
  }
  return url;
};

const loadLogoBuffer = async (logo: string): Promise<Buffer> => {
  if (logo.startsWith("data:image/")) return decodeImageDataUri(logo);

  const url = await assertSafeRemoteUrl(logo);
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`logo fetch failed (${res.status})`);
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_REMOTE_BYTES) throw new Error("logo too large");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_REMOTE_BYTES) throw new Error("logo size invalid");
  return buf;
};

/* ---------- rendering ---------- */

/** Pure: logo bytes + icon file name -> PNG. Exported for tests. */
export const renderBrandIcon = async (logo: Buffer, file: string): Promise<Buffer> => {
  const spec = BRAND_ICON_SPECS[file];
  if (!spec) throw new NotFoundError(t({ bn: "আইকন পাওয়া যায়নি", en: "Icon not found" }));

  const { size, kind } = spec;
  // SVG logos need a decent raster density or small icons come out blurry.
  const source = () => sharp(logo, { limitInputPixels: 50_000_000, density: 300 }).rotate();

  if (kind === "any") {
    return source()
      .resize({ width: size, height: size, fit: "contain", background: CLEAR })
      .png()
      .toBuffer();
  }

  const inner = Math.round(size * (kind === "maskable" ? 0.8 : 0.94));
  const mark = await source()
    .resize({ width: inner, height: inner, fit: "contain", background: CLEAR })
    .png()
    .toBuffer();

  return sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
};

/** One generated icon, ready to show in a preview (PNG as a data URI). */
export interface BrandIconPreview {
  file: string;
  size: number;
  kind: IconKind;
  src: string;
}

/** Pure: renders EVERY icon the logo produces, so the admin / super admin can
 * see exactly what the favicon and PWA icons will look like. Exported for tests. */
export const renderBrandIconPreviews = async (logo: Buffer): Promise<BrandIconPreview[]> =>
  Promise.all(
    Object.entries(BRAND_ICON_SPECS).map(async ([file, spec]) => {
      const png = await renderBrandIcon(logo, file);
      return { file, size: spec.size, kind: spec.kind, src: `data:image/png;base64,${png.toString("base64")}` };
    }),
  );

/** Decodes an uploaded (not yet saved) logo for a preview; a bad file is the
 * caller's mistake (400), not a server error. */
export const decodePreviewImage = (image: unknown): Buffer => {
  if (typeof image !== "string" || !image.trim()) {
    throw new BadRequestError(t({ bn: "লোগো ছবি আবশ্যক", en: "A logo image is required" }));
  }
  try {
    return decodeImageDataUri(image.trim());
  } catch {
    throw new BadRequestError(t({ bn: "ছবিটি পড়া যায়নি, অন্য ছবি দিন", en: "Could not read the image, please try another one" }));
  }
};

const previewOrBadRequest = async (logo: Buffer): Promise<BrandIconPreview[]> => {
  try {
    return await renderBrandIconPreviews(logo);
  } catch {
    throw new BadRequestError(t({ bn: "ছবিটি পড়া যায়নি, অন্য ছবি দিন", en: "Could not read the image, please try another one" }));
  }
};

/* ---------- service ---------- */

const CACHE_LIMIT = 150;
const cache = new Map<string, Buffer>();
const remember = (key: string, png: Buffer) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, png);
};

const normalizeSlug = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

export const brandIconService = {
  /** Resolves to the PNG for `file`, or throws NotFoundError when the madrasa
   * does not exist / is inactive / has no logo set. */
  async getIcon(slugInput: string, file: string): Promise<Buffer> {
    if (!BRAND_ICON_SPECS[file]) throw new NotFoundError(t({ bn: "আইকন পাওয়া যায়নি", en: "Icon not found" }));
    const slug = normalizeSlug(slugInput);
    const notFound = () => new NotFoundError(t({ bn: "আইকন পাওয়া যায়নি", en: "Icon not found" }));
    if (!slug) throw notFound();

    const madrasa = await prisma.madrasa.findFirst({
      where: { slug, deletedAt: null, isActive: 1 },
      select: { id: true, reportLogo: true },
    });
    const logo = madrasa?.reportLogo;
    if (!madrasa || !logo) throw notFound();

    // Keyed by a hash of the logo itself, so a changed/removed logo can never
    // serve a stale render.
    const key = `${madrasa.id}:${file}:${createHash("sha1").update(logo).digest("hex")}`;
    const hit = cache.get(key);
    if (hit) return hit;

    try {
      const png = await renderBrandIcon(await loadLogoBuffer(logo), file);
      remember(key, png);
      return png;
    } catch (err) {
      logger.warn("[brand-icon] could not render icon", { slug, file, error: (err as Error)?.message });
      throw notFound();
    }
  },

  /** Every icon a madrasa's logo produces. With `image` (a base64 data URI) it
   * previews a logo that is not saved yet; without it, the saved logo is used
   * (no logo => empty list). */
  async previewForMadrasa(madrasaId: number, image?: unknown): Promise<BrandIconPreview[]> {
    if (typeof image === "string" && image.trim()) return previewOrBadRequest(decodePreviewImage(image));

    const madrasa = await prisma.madrasa.findFirst({ where: { id: madrasaId, deletedAt: null }, select: { reportLogo: true } });
    if (!madrasa?.reportLogo) return [];
    try {
      return await renderBrandIconPreviews(await loadLogoBuffer(madrasa.reportLogo));
    } catch (err) {
      logger.warn("[brand-icon] could not render preview", { madrasaId, error: (err as Error)?.message });
      return [];
    }
  },
};
