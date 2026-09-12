import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./router";
import { config } from "../shared/config";
import { isKnownCustomDomain } from "../shared/config/customDomainCache";
import { normalizeHost } from "../shared/utils/host.util";
import { errorHandler, notFoundHandler } from "../shared/middleware/error.middleware";
import { requestLogger } from "../shared/middleware/requestLogger.middleware";
import { activityLoggerMiddleware } from "../shared/middleware/activityLogger.middleware";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());
app.use(
  cors({
    async origin(origin, callback) {
      if (!origin || config.cors.origins.includes(origin)) return callback(null, true);

      // Fallback for a tenant's connected custom domain, which can't be
      // known ahead of time in a static CORS_ORIGINS list (see
      // shared/config/customDomainCache.ts).
      const host = normalizeHost(origin);
      if (host && (await isKnownCustomDomain(host))) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: config.cors.credentials,
    // Without this, browsers silently withhold Retry-After (and the
    // RateLimit-* headers express-rate-limit sets) from cross-origin
    // JS — it's not in the default CORS-safelisted response headers — so
    // the frontend's 429 handler could never read a wait time even though
    // the server was sending one correctly.
    exposedHeaders: ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "RateLimit-Policy"],
  }),
);
app.use(express.json({ limit: config.upload.jsonBodyLimit })); // raised to allow branding logo/banner/watermark base64 uploads
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // reads the httpOnly refresh-token cookie into req.cookies
app.use(requestLogger);
app.use(activityLoggerMiddleware);

// API responses must never be cached — tenant status (deleted/suspended)
// can change at any moment via the super admin panel, and a cached stale
// response (e.g. for /auth/login) would keep showing outdated state after
// a restore/activate until the browser's cache was manually cleared.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// GLOBAL rate limiter - an outer abuse/DDoS backstop covering every
// /api/* route, not a functional per-endpoint limit. It's keyed per
// signed-in user/tenant rather than raw IP (see rate-limit.config.ts's
// keyGenerator), so it no longer punishes an entire office's NAT'd IP for
// one busy tenant's normal traffic - a real credential-stuffing/scraping
// burst from one actor still eventually trips it.
// Sensitive pre-auth endpoints (login, forgot/reset-password, refresh) each
// have their OWN much tighter, purpose-built limiter declared right on
// their route in auth.routes.ts / guardian.routes.ts - those are the actual
// brute-force protection and are unaffected by this one. Do not re-tighten
// this global limiter to compensate for something that belongs on a
// route-level limiter instead - that's what caused the cascading-lockout
// bug this comment is here to prevent from coming back.
app.use(rateLimit(config.rateLimit));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "QMS Backend is running successfully.",
    service: "Qawmi Madrasa Management System API",
    provider: "Hikmah IT",
    status: "OK",
  });
});

app.use("/api", router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
