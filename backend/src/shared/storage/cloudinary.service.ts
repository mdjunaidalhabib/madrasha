import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { logger } from "../logger/logger";

export interface UploadImageInput {
  /// A data URI ("data:image/png;base64,...") or a remote https URL -
  /// both are accepted directly by Cloudinary's upload API.
  file: string;
  /// Sub-folder under env.cloudinaryUploadFolder, e.g. "students",
  /// "teachers", "branding". Keeps uploads organized per feature.
  folder: string;
}

export interface UploadImageResult {
  success: boolean;
  configured: boolean;
  url?: string;
  publicId?: string;
  errorMessage?: string;
}

let configured = false;

const isConfigured = () =>
  Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);

const ensureConfigured = () => {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
  configured = true;
};

/**
 * Uploads an image to Cloudinary. All credentials come from `.env` only
 * (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET) -
 * there is no database-backed storage-settings table, so nothing
 * sensitive ever passes through Postgres.
 *
 * If Cloudinary isn't configured yet, this returns `{ configured: false
 * }` rather than throwing, so callers (e.g. the student/teacher photo
 * upload flows) can gracefully keep using the old inline-base64 storage
 * until real credentials are added.
 */
export const cloudinaryService = {
  async uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
    if (!isConfigured()) {
      logger.info("[STORAGE:not-configured] Cloudinary not set up — keeping inline storage", {
        folder: input.folder,
      });
      console.log(
        `\n🖼️  [DEV STORAGE] Cloudinary not configured — image for "${input.folder}" was NOT uploaded to the cloud (caller should keep it inline for now)\n`,
      );
      return { success: false, configured: false };
    }

    ensureConfigured();

    try {
      const result = await cloudinary.uploader.upload(input.file, {
        folder: `${env.cloudinaryUploadFolder}/${input.folder}`,
        resource_type: "image",
      });
      logger.info("[STORAGE:cloudinary] uploaded", { publicId: result.public_id });
      return { success: true, configured: true, url: result.secure_url, publicId: result.public_id };
    } catch (err) {
      logger.error("CloudinaryService.uploadImage failed:", err);
      return {
        success: false,
        configured: true,
        errorMessage: (err as Error)?.message || "Upload failed",
      };
    }
  },

  async deleteImage(publicId: string): Promise<{ success: boolean; errorMessage?: string }> {
    if (!isConfigured()) {
      console.log(`\n🖼️  [DEV STORAGE] Cloudinary not configured — skipped delete of ${publicId}\n`);
      return { success: false };
    }

    ensureConfigured();

    try {
      await cloudinary.uploader.destroy(publicId);
      return { success: true };
    } catch (err) {
      logger.error("CloudinaryService.deleteImage failed:", err);
      return { success: false, errorMessage: (err as Error)?.message || "Delete failed" };
    }
  },
};
