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
  // Short-lived on purpose - this is now just the access token (see
  // RefreshToken model / auth.service.ts#refreshAccessToken). A leaked
  // access token is only usable for this long; long-lived sessions live in
  // the DB-backed refresh token instead, which can be revoked server-side.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  refreshTokenExpiresInDays: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 30),
  rootDomain: process.env.ROOT_DOMAIN || "localhost",
  // Optional full override (e.g. "https://app.example.com") for building
  // links that point at the frontend (password reset emails, etc.) - this
  // one must always be the real public URL, since it ends up in front of an
  // actual user's browser.
  // Falls back to building one from rootDomain when unset.
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || "",
  // Where the server-side PDF export's headless browser navigates instead
  // (see report-export.service.ts) - separate from frontendBaseUrl because
  // when backend and frontend run as sibling containers on the same Docker
  // network (e.g. Coolify), the backend calling its own PUBLIC domain has to
  // go out to the internet and back in through the reverse proxy to reach a
  // container on the very same host/network - a "hairpin NAT" round trip
  // that can hang or time out entirely depending on the network setup. Set
  // this to the frontend's internal Docker hostname (e.g.
  // "http://<frontend-internal-hostname>") to route straight there instead.
  // Falls back to frontendBaseUrl when unset (fine for local dev, or any
  // deployment where the two aren't on a shared internal network).
  internalFrontendUrl: process.env.INTERNAL_FRONTEND_URL || process.env.FRONTEND_BASE_URL || "",
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
  // Each madrasa (tenant) has its own Cloudinary account, configured by the
  // super admin and stored in the `madrasa_cloudinary_configs` table (see
  // MadrasaCloudinaryConfig in prisma/models/tenant.prisma) - the API secret
  // is encrypted at rest with `secretsEncryptionKey` below, via
  // shared/utils/crypto.util.ts. These CLOUDINARY_* vars are unused
  // leftovers from the old single-tenant setup and are no longer read by
  // the upload flow; the folder name still applies per-tenant.
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  // Base folder every upload from this app goes into, e.g.
  // "madrasha/<madrasaId>/students" is built from this + a sub-folder.
  cloudinaryUploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || "madrasha",

  // 32-byte (64 hex char) key used to encrypt per-tenant secrets (currently
  // just Cloudinary API secrets) before they're stored in the database.
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  secretsEncryptionKey: process.env.SECRETS_ENCRYPTION_KEY || "",
};
