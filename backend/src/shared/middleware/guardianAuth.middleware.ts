import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";
import { AuthenticatedGuardian } from "../types/common.types";
import { t } from "../i18n";
import { guardianRepository } from "../../modules/guardian/guardian.repository";
import { guardianCredentialVersion } from "../../modules/guardian/guardian-session";

export const guardianAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: t({ bn: "অনুমতি নেই", en: "Unauthorized" }) });

  const token = header.split(" ")[1];
  try {
    const decoded = verifyToken(token) as AuthenticatedGuardian;

    if (decoded?.type !== "guardian") {
      return res.status(401).json({ message: t({ bn: "টোকেন সঠিক নয়", en: "Invalid token" }) });
    }

    if (req.tenant && decoded.madrasaId !== req.tenant.madrasa_id) {
      return res.status(401).json({ message: t({ bn: "এই প্রতিষ্ঠানের জন্য সেশনটি আর বৈধ নয়", en: "Session no longer valid for this institution" }) });
    }

    const guardian = await guardianRepository.findByIdForTenant(decoded.guardianId, decoded.madrasaId);
    if (!guardian || decoded.credentialVersion !== guardianCredentialVersion(guardian.passwordHash)) {
      return res.status(401).json({ message: t({ bn: "সেশন শেষ হয়েছে। আবার লগইন করুন।", en: "Session expired. Please log in again." }) });
    }
    if (guardian.mustChangePassword && req.path !== "/change-password") {
      return res.status(403).json({ code: "GUARDIAN_PASSWORD_CHANGE_REQUIRED", message: t({ bn: "আগে নতুন পাসওয়ার্ড সেট করুন।", en: "Set a new password first." }) });
    }
    req.guardian = decoded;
    next();
  } catch {
    return res.status(401).json({ message: t({ bn: "টোকেন সঠিক নয়", en: "Invalid token" }) });
  }
};
