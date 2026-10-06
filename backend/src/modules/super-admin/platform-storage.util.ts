import { BadRequestError } from "../../shared/errors";
import { buildObjectKey, r2Service } from "../../shared/storage/r2.service";
import { decodeImageDataUri, presetFor, processImage } from "../../shared/storage/image-processing";
import { platformSettingsService } from "./platform-settings.service";
import { t } from "../../shared/i18n";

/**
 * Super Admin uploads (System Template backgrounds) go to the same
 * platform-wide R2 bucket as tenant uploads, under `platform/` instead of a
 * madrasa prefix.
 */
export async function getPlatformStorageCredentials() {
  const credentials = await platformSettingsService.resolveStorageCredentials();
  if (!credentials) {
    throw new BadRequestError(
      t({ bn: "প্ল্যাটফর্মের স্টোরেজ (Cloudflare R2) কনফিগার করা নেই। সার্ভারের .env-এ R2_* মানগুলো দিন।", en: "Platform storage (Cloudflare R2) is not configured. Set the R2_* variables in the server .env." }),
    );
  }
  return credentials;
}

export async function uploadPlatformBackground(image: string) {
  const credentials = await getPlatformStorageCredentials();
  const webp = await processImage(decodeImageDataUri(image), presetFor("document-templates"));
  const key = buildObjectKey("platform/", "document-templates", "webp");
  try {
    const url = await r2Service.putObject(credentials, key, webp, "image/webp");
    return { url, public_id: key };
  } catch (err) {
    throw new BadRequestError((err as Error)?.message || t({ bn: "ছবি আপলোড ব্যর্থ হয়েছে", en: "Image upload failed" }));
  }
}
