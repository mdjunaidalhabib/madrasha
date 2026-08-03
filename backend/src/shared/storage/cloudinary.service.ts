import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { logger } from "../logger/logger";

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface UploadImageInput {
  /// A data URI ("data:image/png;base64,...") or a remote https URL -
  /// both are accepted directly by Cloudinary's upload API.
  file: string;
  /// Sub-folder under env.cloudinaryUploadFolder, e.g. "students",
  /// "teachers", "branding". Keeps uploads organized per feature.
  folder: string;
  /// This tenant's own Cloudinary account (see MadrasaCloudinaryConfig).
  credentials: CloudinaryCredentials;
}

export interface UploadImageResult {
  success: boolean;
  url?: string;
  publicId?: string;
  errorMessage?: string;
}

/**
 * Uploads an image to a tenant's own Cloudinary account. Credentials are
 * passed per-call (not via the global mutable `cloudinary.config(...)`)
 * because concurrent requests from different tenants must never share or
 * race on account credentials - the Cloudinary Node SDK accepts
 * cloud_name/api_key/api_secret directly in the upload options for exactly
 * this reason.
 *
 * Whether a tenant *has* Cloudinary configured at all is decided by the
 * caller (upload.service.ts, via MadrasaCloudinaryConfig) - this service
 * assumes valid credentials were already found.
 */
export const cloudinaryService = {
  async uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
    try {
      const result = await cloudinary.uploader.upload(input.file, {
        cloud_name: input.credentials.cloudName,
        api_key: input.credentials.apiKey,
        api_secret: input.credentials.apiSecret,
        folder: `${env.cloudinaryUploadFolder}/${input.folder}`,
        resource_type: "image",
      });
      logger.info("[STORAGE:cloudinary] uploaded", { publicId: result.public_id });
      return { success: true, url: result.secure_url, publicId: result.public_id };
    } catch (err) {
      logger.error("CloudinaryService.uploadImage failed:", err);
      return { success: false, errorMessage: (err as Error)?.message || "Upload failed" };
    }
  },

  async deleteImage(
    publicId: string,
    credentials: CloudinaryCredentials,
  ): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      // The SDK's destroy() types don't declare cloud_name/api_key/api_secret
      // (unlike upload's UploadApiOptions), but it accepts and forwards them
      // identically at runtime - same v1_adapters/config-merge pipeline as
      // upload. Cast to bypass that type-declaration gap.
      await cloudinary.uploader.destroy(publicId, {
        cloud_name: credentials.cloudName,
        api_key: credentials.apiKey,
        api_secret: credentials.apiSecret,
      } as unknown as { invalidate?: boolean });
      return { success: true };
    } catch (err) {
      logger.error("CloudinaryService.deleteImage failed:", err);
      return { success: false, errorMessage: (err as Error)?.message || "Delete failed" };
    }
  },
};
