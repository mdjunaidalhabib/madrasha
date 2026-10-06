import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { logger } from "../logger/logger";
import { env } from "../config/env";

/**
 * Cloudflare R2 (S3-compatible) object storage. ONE bucket for the whole
 * platform; the key prefix keeps tenants apart:
 *
 *   madrasas/<slug>/<folder>/<yyyy>/<mm>/<uuid>.webp   tenant uploads
 *   platform/<folder>/<yyyy>/<mm>/<uuid>.webp          Super Admin uploads
 *   downloads/attendance-connector/...                 connector installer (CI)
 *
 * Credentials come from the R2_* env vars (shared/config/env.ts).
 */
export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base URL (r2.dev or custom domain), no trailing slash. */
  publicUrl: string;
}

export const R2_ENV_VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"] as const;

/** Credentials from env, or null until every R2_* var is set. */
export const r2CredentialsFromEnv = (): R2Credentials | null => {
  const c: R2Credentials = {
    accountId: env.r2AccountId.trim(),
    accessKeyId: env.r2AccessKeyId.trim(),
    secretAccessKey: env.r2SecretAccessKey.trim(),
    bucket: env.r2Bucket.trim(),
    publicUrl: env.r2PublicUrl.trim(),
  };
  return Object.values(c).every(Boolean) ? c : null;
};

let cached:{ signature: string; client: S3Client } | null = null;

const clientFor = (c: R2Credentials): S3Client => {
  const signature = `${c.accountId}|${c.accessKeyId}|${c.secretAccessKey}`;
  if (cached?.signature === signature) return cached.client;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  cached = { signature, client };
  return client;
};

/** Lowercase a-z0-9- only, so a slug can never escape its prefix ("../", "/"). */
export const safeSegment = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";

export const tenantPrefix = (slug: string) => `madrasas/${safeSegment(slug)}/`;

/** `<prefix><folder>/<yyyy>/<mm>/<uuid>.<ext>` */
export const buildObjectKey = (prefix: string, folder: string, ext: string): string => {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}${safeSegment(folder)}/${now.getUTCFullYear()}/${mm}/${randomUUID()}.${ext}`;
};

/** Where .github/workflows/connector-release.yml uploads the installer. */
export const CONNECTOR_INSTALLER_KEY = "downloads/attendance-connector/AttendanceConnectorSetup.exe";

export const publicUrlFor =(c: R2Credentials, key: string) => `${c.publicUrl.replace(/\/+$/, "")}/${key}`;

export const r2Service = {
  async putObject(c: R2Credentials, key: string, body: Buffer, contentType: string): Promise<string> {
    await clientFor(c).send(
      new PutObjectCommand({
        Bucket: c.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Keys are content-unique (uuid), so the object never changes.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    logger.info("[STORAGE:r2] uploaded", { key, bytes: body.length });
    return publicUrlFor(c, key);
  },

  async deleteObject(c: R2Credentials, key: string): Promise<boolean> {
    try {
      await clientFor(c).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
      return true;
    } catch (err) {
      logger.error("R2 deleteObject failed:", err);
      return false;
    }
  },

  /** Verifies the credentials can reach the bucket. */
  async testConnection(c: R2Credentials): Promise<{ ok: boolean; message?: string }> {
    try {
      await clientFor(c).send(new HeadBucketCommand({ Bucket: c.bucket }));
      return { ok: true };
    } catch (err) {
      const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
      return { ok: false, message: `${e.name || "Error"}${e.$metadata?.httpStatusCode ? ` (HTTP ${e.$metadata.httpStatusCode})` : ""}: ${e.message || ""}`.trim() };
    }
  },
};
