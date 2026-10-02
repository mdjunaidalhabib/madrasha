import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";
import { AuthenticatedUser } from "../types/common.types";
import { isSessionActive } from "../auth/sessionStatus";
import { t } from "../i18n";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: t({ bn: "অনুমতি নেই", en: "Unauthorized" }) });

  const token = header.split(" ")[1];
  try {
    const decoded = verifyToken(token) as AuthenticatedUser;

    // Guardian tokens carry no role_id/RBAC identity - they must never be
    // accepted by tenant-admin routes, including ones that only have
    // tenantMiddleware+authMiddleware (no rbacMiddleware) such as GET /dashboard.
    if (decoded?.type === "guardian") {
      return res.status(401).json({ message: t({ bn: "টোকেন সঠিক নয়", en: "Invalid token" }) });
    }

    // If this route already resolved a tenant from the URL's slug
    // (tenantMiddleware runs first), make sure the token actually belongs
    // to THAT madrasa. A token is only ever valid for the madrasa it was
    // issued for — if the slug now points to a different (e.g. newly
    // created) madrasa, or the original madrasa no longer exists, this
    // token must be rejected rather than silently trusted.
    if (req.tenant && decoded?.madrasa_id !== req.tenant.madrasa_id) {
      return res.status(401).json({ message: t({ bn: "এই প্রতিষ্ঠানের জন্য সেশনটি আর বৈধ নয়", en: "Session no longer valid for this institution" }) });
    }

    // Like Facebook/Gmail: once a device is logged out (from the device
    // list, "log out other devices" or a password change) its access token
    // stops working on the next request instead of lingering until expiry.
    // Tokens issued before session ids existed carry no sid and are let
    // through until they expire on their own.
    if (typeof decoded?.sid === "number" && !(await isSessionActive(decoded.sid))) {
      return res.status(401).json({ message: t({ bn: "এই ডিভাইস থেকে লগআউট করা হয়েছে", en: "This device has been logged out" }) });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: t({ bn: "টোকেন সঠিক নয়", en: "Invalid token" }) });
  }
};
