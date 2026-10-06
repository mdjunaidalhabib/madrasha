import { getText } from "@madrasha/shared-ui/src/i18n";
import { servicesText } from "../services/services.text";

// Image URL columns across the schema (website logo/gallery/slide/committee
// photo, report branding logo/banner/watermark, etc.) only ever expect a
// cloud storage URL. Until the super admin configures this tenant's cloud
// storage account, BrandImageBox falls back to a raw base64 data URI (tens
// of thousands of characters), which either fails outright (VARCHAR-limited
// columns) or silently bloats the database (unbounded text columns).
// Block that save client-side instead, with a message that explains why
// (without naming the storage vendor - that's an implementation detail
// tenant staff don't need to know).

/** Bangla original, kept for any caller that still imports the constant -
 * prefer cloudNotConfiguredMsg(), which follows the UI language. */
export const CLOUD_NOT_CONFIGURED_MSG =
  "ক্লাউড স্টোরেজ এখনো কনফিগার করা হয়নি, তাই ছবিটি স্থায়ীভাবে সংরক্ষণ করা যাচ্ছে না। এডমিনের সাথে যোগাযোগ করুন।";

export const cloudNotConfiguredMsg = () => getText(servicesText).cloudNotConfigured;

export const isPendingCloudUpload = (value?: string | null) =>
  typeof value === "string" && value.startsWith("data:image/");

/** Extracts the R2 object key from a stored image URL, e.g.
 * "https://cdn.example.com/madrasas/abc/students/2026/10/uuid.webp"
 * -> "madrasas/abc/students/2026/10/uuid.webp". Returns null for anything
 * else (external URLs, base64), which the backend can't delete. */
export const getStoragePublicId = (url?: string | null): string | null => {
  if (!url || !url.startsWith("https://")) return null;
  const match = url.match(/\/(madrasas\/[^?#]+)$/);
  return match ? match[1] : null;
};
