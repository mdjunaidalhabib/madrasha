import { BadRequestError } from "../../shared/errors";
import { cloudinaryService } from "../../shared/storage/cloudinary.service";
import { platformSettingsService } from "./platform-settings.service";

/**
 * This is the same platform-wide Cloudinary account that upload.service.ts
 * now also uses for every tenant's uploads. Credentials come from
 * PlatformCloudinaryConfig (see platform-settings.service.ts), configured
 * from the Super Admin Settings page - not from backend/.env (the
 * CLOUDINARY_* env vars remain unused leftovers).
 */
export async function getPlatformCloudinaryCredentials() {
  const credentials = await platformSettingsService.resolveCredentials();
  if (!credentials) {
    throw new BadRequestError(
      "Platform Cloudinary account is not configured. Go to Super Admin → Settings and add your Cloudinary Cloud Name, API Key and API Secret.",
    );
  }
  return credentials;
}

export async function uploadPlatformBackground(image: string) {
  const credentials = await getPlatformCloudinaryCredentials();
  const result = await cloudinaryService.uploadImage({ file: image, folder: "document-templates", credentials });
  if (!result.success) {
    throw new BadRequestError(result.errorMessage || "Image upload failed");
  }
  return { url: result.url, public_id: result.publicId };
}
