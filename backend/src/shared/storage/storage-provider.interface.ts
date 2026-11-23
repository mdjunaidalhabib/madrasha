/**
 * Validation and persistence of hosted image URLs used by settings.
 * Upload processing/storage is handled separately by UploadService.
 */
export interface IStorageProvider {
  /** Returns true if `value` is an acceptable stored-image value (or empty/null). */
  isValidImage(value: unknown): value is string | null;
  /** Normalizes an incoming image value for persistence (currently a no-op passthrough). */
  persistImage(value: string | null): string | null;
}
