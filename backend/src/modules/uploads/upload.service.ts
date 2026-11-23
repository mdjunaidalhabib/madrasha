import { BadRequestError, ForbiddenError } from "../../shared/errors";
import { buildObjectKey, r2Service, tenantPrefix } from "../../shared/storage/r2.service";
import { decodeImageDataUri, presetFor, processImage } from "../../shared/storage/image-processing";
import { platformSettingsService } from "../super-admin/platform-settings.service";
import { UploadImageRequestDto, DeleteImageRequestDto } from "./upload.dto";
import { t } from "../../shared/i18n";
import { findReferencedImageKeys } from "../../shared/storage/image-references";

const ALLOWED_FOLDERS = [
  "students",
  "teachers",
  "staff",
  "profile",
  "branding",
  "gallery",
  "certificates",
  "document-templates",
  "misc",
];

export interface UploadTenant {
  madrasaId: number;
  slug: string;
}

export class UploadService {
  /** Every madrasa shares the single platform-wide R2 bucket (configured by
   * the R2_* env vars); each one writes only under its own
   * `madrasas/<slug>/` prefix. */
  async uploadImage(tenant: UploadTenant, dto: UploadImageRequestDto) {
    if (typeof dto.image !== "string" || !dto.image.startsWith("data:image/")) {
      throw new BadRequestError(t({ bn: "ছবি অবশ্যই base64 data URI (data:image/...) হতে হবে", en: "image must be a base64 data URI (data:image/...)" }));
    }

    const folder = ALLOWED_FOLDERS.includes(dto.folder || "") ? dto.folder! : "misc";

    const credentials = await platformSettingsService.resolveStorageCredentials();
    if (!credentials) {
      // Never hand back an inline fallback that could bloat database rows.
      throw new BadRequestError(t({ bn: "ছবি সংরক্ষণের ব্যবস্থা চালু নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।", en: "Image storage is not configured. Contact your administrator." }));
    }

    const webp = await processImage(decodeImageDataUri(dto.image), presetFor(folder));
    const key = buildObjectKey(tenantPrefix(tenant.slug), folder, "webp");
    try {
      const url = await r2Service.putObject(credentials, key, webp, "image/webp");
      return { uploaded: true, configured: true, url, public_id: key, bytes: webp.length, max_bytes: presetFor(folder).maxBytes };
    } catch (err) {
      throw new BadRequestError((err as Error)?.message || "Image upload failed");
    }
  }

  async deleteImage(tenant: UploadTenant, dto: DeleteImageRequestDto) {
    if (typeof dto.public_id !== "string" || !dto.public_id) throw new BadRequestError(t({ bn: "public_id আবশ্যক", en: "public_id is required" }));

    // Anything outside madrasas/ (e.g. an external URL) is not ours to
    // delete - report "not deleted" instead of failing the save.
    if (!dto.public_id.startsWith("madrasas/")) return { deleted: false };

    // A madrasa may only delete inside its own prefix.
    if (!dto.public_id.startsWith(tenantPrefix(tenant.slug)) || dto.public_id.includes("..")) {
      throw new ForbiddenError(t({ bn: "এই ছবি মুছার অনুমতি নেই", en: "Not allowed to delete this image" }));
    }

    const credentials = await platformSettingsService.resolveStorageCredentials();
    if (!credentials) return { deleted: false };

    if ((await findReferencedImageKeys([dto.public_id])).has(dto.public_id)) {
      return { deleted: false, reason: "in_use" };
    }

    return { deleted: await r2Service.deleteObject(credentials, dto.public_id) };
  }
}

export const uploadService = new UploadService();
