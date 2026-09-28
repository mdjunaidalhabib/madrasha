import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.config";
import { t } from "../i18n";

export const superAdminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ message: t({ bn: "অনুমতি নেই", en: "Unauthorized" }) });

  const token = authHeader.split(" ")[1];

  try {
    const decoded: any = jwt.verify(token, jwtConfig.secret);

    if (decoded.role !== "super_admin") return res.status(403).json({ message: t({ bn: "অনুমতি নেই", en: "Forbidden" }) });

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: t({ bn: "টোকেন সঠিক নয়", en: "Invalid token" }) });
  }
};
