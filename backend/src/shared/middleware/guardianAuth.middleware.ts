import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";
import { AuthenticatedGuardian } from "../types/common.types";
import { t } from "../i18n";

export const guardianAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: t({ bn: "অনুমতি নেই", en: "Unauthorized", ar: "غير مصرح" }) });

  const token = header.split(" ")[1];
  try {
    const decoded = verifyToken(token) as AuthenticatedGuardian;

    if (decoded?.type !== "guardian") {
      return res.status(401).json({ message: t({ bn: "টোকেন সঠিক নয়", en: "Invalid token", ar: "الرمز غير صالح" }) });
    }

    if (req.tenant && decoded.madrasaId !== req.tenant.madrasa_id) {
      return res.status(401).json({ message: t({ bn: "এই প্রতিষ্ঠানের জন্য সেশনটি আর বৈধ নয়", en: "Session no longer valid for this institution", ar: "الجلسة لم تعد صالحة لهذه المؤسسة" }) });
    }

    req.guardian = decoded;
    next();
  } catch {
    return res.status(401).json({ message: t({ bn: "টোকেন সঠিক নয়", en: "Invalid token", ar: "الرمز غير صالح" }) });
  }
};
