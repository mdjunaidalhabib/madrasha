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
  corsOrigins: (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "15mb",
  // ~3MB base64 safety limit per inline image (branding logo/banner/watermark, student photo, ...)
  maxInlineImageLength: Number(process.env.MAX_INLINE_IMAGE_LENGTH || 3_000_000),
};
