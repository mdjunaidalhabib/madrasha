import { BadRequestError } from "../../shared/errors";
import { cloudinaryService } from "../../shared/storage/cloudinary.service";
import { platformSettingsService } from "./platform-settings.service";
import { t } from "../../shared/i18n";

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
      t({ bn: "প্ল্যাটফর্মের Cloudinary অ্যাকাউন্ট কনফিগার করা নেই। সুপার অ্যাডমিন → সেটিংসে গিয়ে Cloudinary Cloud Name, API Key ও API Secret যোগ করুন।", en: "Platform Cloudinary account is not configured. Go to Super Admin → Settings and add your Cloudinary Cloud Name, API Key and API Secret.", ar: "حساب Cloudinary للمنصة غير مُعد. انتقل إلى المشرف العام ← الإعدادات وأضف Cloud Name و API Key و API Secret." }),
    );
  }
  return credentials;
}

export async function uploadPlatformBackground(image: string) {
  const credentials = await getPlatformCloudinaryCredentials();
  const result = await cloudinaryService.uploadImage({ file: image, folder: "document-templates", credentials });
  if (!result.success) {
    throw new BadRequestError(result.errorMessage || t({ bn: "ছবি আপলোড ব্যর্থ হয়েছে", en: "Image upload failed" }));
  }
  return { url: result.url, public_id: result.publicId };
}
