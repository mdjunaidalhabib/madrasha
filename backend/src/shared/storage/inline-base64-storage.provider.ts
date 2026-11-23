import { IStorageProvider } from "./storage-provider.interface";

/**
 * Historical class name retained for imports. New writes accept hosted HTTPS
 * images only; upload.service processes and stores their binary data in R2.
 * Existing inline rows remain readable, but must be re-uploaded when changed.
 */
export class InlineBase64StorageProvider implements IStorageProvider {
  isValidImage(value: unknown): value is string | null {
    if (value === null || value === undefined || value === "") return true;
    if (typeof value !== "string") return false;
    if (value.length > 2048) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  persistImage(value: string | null): string | null {
    return value ?? null;
  }
}

export const storageProvider: IStorageProvider = new InlineBase64StorageProvider();
