/**
 * Abstraction over "where an uploaded image lives". Today the only
 * implementation is `InlineBase64StorageProvider` (images are validated
 * and stored as base64 data URIs directly on the row - see
 * settings.controller's branding logo/banner/watermark and the
 * student.image column). Swapping to S3/Cloudinary later means adding
 * a new class that implements this interface (e.g. store the binary,
 * return a URL instead of the data URI) without touching any
 * controller/service call sites, since they only depend on this
 * interface.
 */
export interface IStorageProvider {
  /** Returns true if `value` is an acceptable stored-image value (or empty/null). */
  isValidImage(value: unknown): value is string | null;
  /** Normalizes an incoming image value for persistence (currently a no-op passthrough). */
  persistImage(value: string | null): string | null;
}
