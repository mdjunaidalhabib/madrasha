import { Request, Response, NextFunction } from "express";
import { logger } from "../logger/logger";

// Successful (2xx/3xx) request-এর জন্য "Request completed" লগ আর প্রিন্ট হয়
// না — dev হোক বা production, টার্মিনালে শুধু error (5xx) আর warn (4xx) দেখাবে।
// দরকার হলে LOG_ALL_REQUESTS=true সেট করে আবার সব লগ ফিরিয়ে আনা যাবে।
const shouldLogSuccessfulRequests = process.env.LOG_ALL_REQUESTS === "true";

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
    else if (shouldLogSuccessfulRequests) logger.info("Request completed", meta);
  });

  next();
};
