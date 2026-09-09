import { BadRequestError } from "../../shared/errors";
import { cloudinaryService, CloudinaryCredentials } from "../../shared/storage/cloudinary.service";
import { platformSettingsService } from "../super-admin/platform-settings.service";
import { UploadImageRequestDto, DeleteImageRequestDto } from "./upload.dto";

const ALLOWED_FOLDERS = [
  "students",
  "teachers",
  "staff",
  "branding",
  "gallery",
  "certificates",
  "document-templates",
  "misc",
];

export class UploadService {
  /** Every madrasa shares the single platform-wide Cloudinary account
   * (configured by the super admin in Settings) - there used to be a
   * per-madrasa override here, but that system was removed in favor of one
   * shared account for everyone. */
  private async getCredentials(): Promise<CloudinaryCredentials | null> {
    return platformSettingsService.resolveCredentials();
  }

  async uploadImage(madrasaId: number, dto: UploadImageRequestDto) {
    if (!dto.image || !dto.image.startsWith("data:image/")) {
      throw new BadRequestError("image must be a base64 data URI (data:image/...)");
    }

    const folder = ALLOWED_FOLDERS.includes(dto.folder || "") ? dto.folder! : "misc";

    const credentials = await this.getCredentials();
    if (!credentials) {
      // Not an error - the caller (frontend) should refuse to persist the
      // base64 it already has and tell the admin to contact the super
      // admin, since this tenant has no Cloudinary account configured yet.
      return { uploaded: false, configured: false, url: null, public_id: null };
    }

    const result = await cloudinaryService.uploadImage({ file: dto.image, folder, credentials });
    if (!result.success) {
      throw new BadRequestError(result.errorMessage || "Image upload failed");
    }

    return { uploaded: true, configured: true, url: result.url, public_id: result.publicId };
  }

  async deleteImage(_madrasaId: number, dto: DeleteImageRequestDto) {
    if (!dto.public_id) throw new BadRequestError("public_id is required");

    const credentials = await this.getCredentials();
    if (!credentials) return { deleted: false };

    const result = await cloudinaryService.deleteImage(dto.public_id, credentials);
    return { deleted: result.success };
  }
}

export const uploadService = new UploadService();
