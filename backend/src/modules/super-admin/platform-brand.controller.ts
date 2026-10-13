import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { t } from "../../shared/i18n";
import { platformBrandService } from "./platform-brand.service";

const respondError = (res: Response, error: unknown, logTag: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(logTag, error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
};

/* ---------- Super Admin (guarded by superAdminMiddleware in the routes) ---------- */

export const getPlatformAdminLogo = async (_req: Request, res: Response) => {
  try {
    res.json({ data: await platformBrandService.getAdminLogo() });
  } catch (error) {
    respondError(res, error, "getPlatformAdminLogo ERROR:");
  }
};

export const savePlatformAdminLogo = async (req: Request, res: Response) => {
  try {
    const data = await platformBrandService.saveAdminLogo(req.body?.image);
    res.json({ data, message: t({ bn: "অ্যাডমিন প্যানেলের লোগো সংরক্ষণ হয়েছে", en: "Admin panel logo saved" }) });
  } catch (error) {
    respondError(res, error, "savePlatformAdminLogo ERROR:");
  }
};

export const previewPlatformAdminLogo = async (req: Request, res: Response) => {
  try {
    res.json({ data: await platformBrandService.previewIcons(req.body?.image) });
  } catch (error) {
    respondError(res, error, "previewPlatformAdminLogo ERROR:");
  }
};

export const deletePlatformAdminLogo = async (_req: Request, res: Response) => {
  try {
    await platformBrandService.deleteAdminLogo();
    res.json({ message: t({ bn: "অ্যাডমিন প্যানেলের লোগো মুছে ফেলা হয়েছে", en: "Admin panel logo removed" }) });
  } catch (error) {
    respondError(res, error, "deletePlatformAdminLogo ERROR:");
  }
};

/* ---------- Public (the admin panel's <head> / PWA manifest read these) ---------- */

/** Revalidated on every load: this is what tells the admin panel whether the
 * logo changed or was removed. (The global /api middleware already sends no-store.) */
export const getPublicPlatformBrand = async (_req: Request, res: Response) => {
  try {
    res.json({ data: await platformBrandService.getPublicInfo() });
  } catch (error) {
    respondError(res, error, "getPublicPlatformBrand ERROR:");
  }
};

export const getPublicPlatformIcon = async (req: Request, res: Response) => {
  try {
    const png = await platformBrandService.getIcon(String(req.params.file || ""));
    // Same as the per-madrasa icons: cacheable (the ?v= fingerprint changes with
    // the logo) and loadable from the admin origin despite helmet's default CORP.
    res.removeHeader("Pragma");
    res.removeHeader("Expires");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", req.query.v ? "public, max-age=31536000, immutable" : "no-cache");
    res.type("image/png").send(png);
  } catch (error) {
    respondError(res, error, "getPublicPlatformIcon ERROR:");
  }
};
