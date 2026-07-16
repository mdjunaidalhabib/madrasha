import { Request, Response, NextFunction } from "express";
import { logger } from "../logger/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const meta = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userId: req.user?.id,
      madrasaId: req.tenant?.madrasa_id || req.user?.madrasa_id,
    };

    if (res.statusCode >= 500) logger.error("Request failed", meta);
    else if (res.statusCode >= 400) logger.warn("Request rejected", meta);
    else logger.info("Request completed", meta);
  });

  next();
};
