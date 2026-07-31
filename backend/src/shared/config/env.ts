import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Flat, backward-compatible env object - kept so nothing else in the
 * codebase breaks. New code should prefer the grouped `config` export
 * below (from `./index`) which organizes these same values by domain
 * (app / database / jwt / cors / rateLimit / upload).
 */
export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  dbHost: required("DB_HOST", "localhost"),
  dbUser: required("DB_USER", "postgres"),
  dbPass: process.env.DB_PASS || "",
  dbName: required("DB_NAME"),
  // Prisma reads DATABASE_URL directly from process.env (see prisma/schema.prisma),
  // but we also build/export it here so a single .env with the old DB_* vars
  // still works without duplicating credentials.
  databaseUrl:
    process.env.DATABASE_URL ||
    `postgresql://${encodeURIComponent(process.env.DB_USER || "postgres")}:${encodeURIComponent(
      process.env.DB_PASS || "",
    )}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || ""}`,
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  rootDomain: process.env.ROOT_DOMAIN || "localhost",
  // Optional full override (e.g. "https://app.example.com") for building
  // links that point at the frontend (password reset emails, etc.).
  // Falls back to building one from rootDomain when unset.
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || "",
  corsOrigins: (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "15mb",
  // ~3MB base64 safety limit per inline image (branding logo/banner/watermark, student photo, ...)
  maxInlineImageLength: Number(process.env.MAX_INLINE_IMAGE_LENGTH || 3_000_000),

  /* ================= EMAIL (nodemailer / SMTP) ================= */
  // All optional: when smtpHost is unset, EmailService logs "would have
  // sent" to the console instead of actually connecting anywhere, so the
  // app still runs (and is testable) before real SMTP credentials exist.
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFromName: process.env.SMTP_FROM_NAME || "Madrasa Management",
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "",

  /* ================= SMS (generic HTTP gateway) ================= */
  // Written generically (configurable URL/param names) since Bangladeshi
  // SMS gateways (SSLWireless, Alpha SMS, BulkSMSBD, ...) all differ
  // slightly in their request shape but are all a simple HTTP GET/POST
  // with an api key, sender id, number, and message. Point this at
  // whichever gateway you already have an account with.
  smsApiUrl: process.env.SMS_API_URL || "",
  smsApiKey: process.env.SMS_API_KEY || "",
  smsSenderId: process.env.SMS_SENDER_ID || "",
  // "GET" or "POST" - which HTTP method the gateway expects.
  smsHttpMethod: (process.env.SMS_HTTP_METHOD || "GET").toUpperCase(),
  // Query/body param names, since every gateway names these differently.
  smsParamApiKey: process.env.SMS_PARAM_API_KEY || "api_key",
  smsParamSenderId: process.env.SMS_PARAM_SENDER_ID || "senderid",
  smsParamNumber: process.env.SMS_PARAM_NUMBER || "number",
  smsParamMessage: process.env.SMS_PARAM_MESSAGE || "message",

  /* ================= FILE STORAGE (Cloudinary) ================= */
  // Everything storage-related is driven from these env vars only -
  // there is no DB-based "storage settings" table, so credentials never
  // pass through the database. When cloudName/apiKey/apiSecret aren't
  // all set, CloudinaryService reports "not configured" instead of
  // throwing, so callers can fall back to the old inline-base64 behavior.
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  // Base folder every upload from this app goes into, e.g.
  // "madrasha/<madrasaId>/students" is built from this + a sub-folder.
  cloudinaryUploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || "madrasha",
};
