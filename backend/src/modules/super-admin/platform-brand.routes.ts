import { Router } from "express";
import { getPublicPlatformBrand, getPublicPlatformIcon } from "./platform-brand.controller";

/**
 * PUBLIC (no auth, no tenant): the main admin panel's own favicon / PWA icons,
 * rendered from the logo the Super Admin set in Settings.
 *   GET /api/platform-brand            -> { data: { version: string | null } }
 *   GET /api/platform-brand/icon/:file -> PNG, or 404 when no logo is set
 * Super Admin management lives under /api/super/platform-settings/logo.
 */
const router = Router();

router.get("/", getPublicPlatformBrand);
router.get("/icon/:file", getPublicPlatformIcon);

export default router;
