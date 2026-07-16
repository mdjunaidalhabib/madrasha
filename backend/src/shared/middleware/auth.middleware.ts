import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";
import { AuthenticatedUser } from "../types/common.types";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Unauthorized" });

  const token = header.split(" ")[1];
  try {
    const decoded = verifyToken(token) as AuthenticatedUser;

    // If this route already resolved a tenant from the URL's slug
    // (tenantMiddleware runs first), make sure the token actually belongs
    // to THAT madrasa. A token is only ever valid for the madrasa it was
    // issued for — if the slug now points to a different (e.g. newly
    // created) madrasa, or the original madrasa no longer exists, this
    // token must be rejected rather than silently trusted.
    if (req.tenant && decoded?.madrasa_id !== req.tenant.madrasa_id) {
      return res.status(401).json({ message: "Session no longer valid for this madrasa" });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
