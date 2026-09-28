import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "../../shared/logger/logger";
import { kioskRepository } from "./kiosk.repository";
import { t } from "../../shared/i18n";

/**
 * Authenticates a gate kiosk device via its raw API key (sent in the
 * `x-kiosk-key` header) instead of a User JWT - the kiosk has no logged-in
 * admin, so this is a separate auth track from authMiddleware, the same
 * way guardian tokens are kept separate from admin JWTs in this app.
 */
export const kioskDeviceAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawKey = req.headers["x-kiosk-key"];
    if (!rawKey || typeof rawKey !== "string") {
      return res.status(401).json({ message: t({ bn: "কিয়স্ক কী আবশ্যক", en: "Kiosk key required" }) });
    }

    const madrasaId = req.tenant?.madrasa_id;
    if (!madrasaId) {
      return res.status(400).json({ message: t({ bn: "টেন্যান্টে প্রতিষ্ঠান পাওয়া যায়নি", en: "Institution not found in tenant" }) });
    }

    const apiKeyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const device = await kioskRepository.findActiveDeviceByKeyHash(Number(madrasaId), apiKeyHash);
    if (!device) {
      return res.status(401).json({ message: t({ bn: "কিয়স্ক ডিভাইসটি সঠিক নয় বা নিষ্ক্রিয়", en: "Invalid or inactive kiosk device" }) });
    }

    req.kioskDevice = { id: device.id, name: device.name };
    kioskRepository.touchLastSeen(device.id).catch(() => {}); // fire-and-forget

    next();
  } catch (err) {
    logger.error("Kiosk device auth error", err);
    return res.status(500).json({ message: t({ bn: "কিয়স্ক যাচাই ব্যর্থ হয়েছে", en: "Kiosk authentication failed" }) });
  }
};
