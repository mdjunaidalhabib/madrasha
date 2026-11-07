import { Request, Response, NextFunction } from "express";
import { publicPlansService } from "./public-plans.service";

export async function getPublicPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await publicPlansService.list();
    res.removeHeader("Pragma");
    res.removeHeader("Expires");
    res.setHeader("Cache-Control", "public, max-age=60");
    // Browser and server caches share the same freshness window.
    res.setHeader("Age", String(publicPlansService.cacheAgeSeconds()));
    res.json({ data });
  } catch (error) {
    next(error);
  }
}
