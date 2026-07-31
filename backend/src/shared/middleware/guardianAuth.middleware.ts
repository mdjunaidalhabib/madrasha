import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";
import { AuthenticatedGuardian } from "../types/common.types";

export const guardianAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Unauthorized" });

  const token = header.split(" ")[1];
  try {
    const decoded = verifyToken(token) as AuthenticatedGuardian;

    if (decoded?.type !== "guardian") {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (req.tenant && decoded.madrasaId !== req.tenant.madrasa_id) {
      return res.status(401).json({ message: "Session no longer valid for this madrasa" });
    }

    req.guardian = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
