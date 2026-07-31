import { BadRequestError } from "../../shared/errors";
import { cloudinaryService } from "../../shared/storage/cloudinary.service";
import { UploadImageRequestDto, DeleteImageRequestDto } from "./upload.dto";

const ALLOWED_FOLDERS = ["students", "teachers", "branding", "gallery", "certificates", "misc"];

export class UploadService {
  async uploadImage(dto: UploadImageRequestDto) {
    if (!dto.image || !dto.image.startsWith("data:image/")) {
      throw new BadRequestError("image must be a base64 data URI (data:image/...)");
    }

    const folder = ALLOWED_FOLDERS.includes(dto.folder || "") ? dto.folder! : "misc";

    const result = await cloudinaryService.uploadImage({ file: dto.image, folder });

    if (!result.configured) {
      // Not an error - the caller (frontend) should keep using the
      // base64 it already has. Signaled distinctly from a real failure.
      return { uploaded: false, configured: false, url: null, public_id: null };
    }
    if (!result.success) {
      throw new BadRequestError(result.errorMessage || "Image upload failed");
    }

    return { uploaded: true, configured: true, url: result.url, public_id: result.publicId };
  }

  async deleteImage(dto: DeleteImageRequestDto) {
    if (!dto.public_id) throw new BadRequestError("public_id is required");
    const result = await cloudinaryService.deleteImage(dto.public_id);
    return { deleted: result.success };
  }
}

export const uploadService = new UploadService();
