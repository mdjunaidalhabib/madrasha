import { IStorageProvider } from "./storage-provider.interface";
import { uploadConfig } from "../config/upload.config";

/**
 * Current (and only) storage provider: validates base64 `data:image/...`
 * URIs and persists them exactly as received. This is the behavior the
 * settings module (branding logo/banner/watermark) already relies on -
 * extracted here unchanged so it can be swapped for a real object-storage
 * provider later without touching controllers/services.
 */
export class InlineBase64StorageProvider implements IStorageProvider {
  isValidImage(value: unknown): value is string | null {
    if (value === null || value === undefined || value === "") return true;
    if (typeof value !== "string") return false;
    if (!value.startsWith(uploadConfig.allowedImagePrefix)) return false;
    if (value.length > uploadConfig.maxInlineImageLength) return false;
    return true;
  }

  persistImage(value: string | null): string | null {
    return value ?? null;
  }
}

export const storageProvider: IStorageProvider = new InlineBase64StorageProvider();
