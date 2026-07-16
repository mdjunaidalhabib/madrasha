import { env } from "./env";

/**
 * The app currently stores images (branding logo/banner/watermark,
 * student photos) as base64 data URIs directly on the row - there is
 * no disk/object storage yet. This config centralizes the limits that
 * behavior depends on so they aren't magic numbers scattered across
 * controllers, and gives the future disk/S3/Cloudinary storage
 * provider (see shared/storage) a single place to read limits from.
 */
export const uploadConfig = {
  jsonBodyLimit: env.jsonBodyLimit,
  maxInlineImageLength: env.maxInlineImageLength,
  allowedImagePrefix: "data:image/",
};
