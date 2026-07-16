import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./router";
import { config } from "../shared/config";
import { errorHandler, notFoundHandler } from "../shared/middleware/error.middleware";
import { requestLogger } from "../shared/middleware/requestLogger.middleware";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.cors.origins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: config.cors.credentials,
  }),
);
app.use(express.json({ limit: config.upload.jsonBodyLimit })); // raised to allow branding logo/banner/watermark base64 uploads
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

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

app.use(rateLimit(config.rateLimit));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "madrasa-backend" });
});

app.use("/api", router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
