import SharedPhotoPicker, { type PhotoPickerProps } from "@madrasha/shared-ui/src/components/photo/PhotoPicker";
import { uploadApi, type UploadFolder } from "../../services/phase4Api";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
export { CameraCaptureModal, fileToPortraitDataUrl } from "@madrasha/shared-ui/src/components/photo/PhotoPicker";

export async function uploadPhoto(dataUrl: string, folder: UploadFolder): Promise<string> {
  try {
    const res = await uploadApi.uploadImage(dataUrl, folder);
    const data = res.data?.data;
    if (data?.uploaded && data.url) return data.url;
  } catch (err) {
    logger.error("PHOTO UPLOAD ERROR:", err);
  }
  return dataUrl;
}

export default function PhotoPicker({ folder, ...props }: Omit<PhotoPickerProps, "upload"> & { folder: UploadFolder }) {
  return <SharedPhotoPicker {...props} upload={(dataUrl) => uploadPhoto(dataUrl, folder)} />;
}
