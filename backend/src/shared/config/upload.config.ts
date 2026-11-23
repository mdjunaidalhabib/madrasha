import { env } from "./env";

/**
 * HTTP envelope limits. Image binaries are processed and stored in R2;
 * per-image input/output limits live in storage/image-processing.ts.
 * Legacy inline settings remain for compatibility with existing configuration.
 */
export const uploadConfig = {
  jsonBodyLimit: env.jsonBodyLimit,
  maxInlineImageLength: env.maxInlineImageLength,
  allowedImagePrefix: "data:image/",
};
