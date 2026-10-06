import sharp from "sharp";
import { BadRequestError } from "../errors";
import { t } from "../i18n";

/**
 * Every uploaded image is re-encoded to WebP before it is stored. R2 has no
 * on-the-fly transforms, so the size each image is shown at is decided
 * here, once, at upload time.
 */
export interface ImagePreset {
  width: number;
  height?: number;
  /** "cover" = crop to exactly width x height; "inside" = only shrink, keep ratio. */
  fit: "cover" | "inside";
  quality: number;
}

/** Profile photo: passport-style 3:4, 300x400 px (~15-30 KB). */
export const PROFILE_PHOTO_PRESET: ImagePreset = { width: 300, height: 400, fit: "cover", quality: 80 };

const PRESETS: Record<string, ImagePreset> = {
  students: PROFILE_PHOTO_PRESET,
  teachers: PROFILE_PHOTO_PRESET,
  staff: PROFILE_PHOTO_PRESET,
  profile: PROFILE_PHOTO_PRESET,
  // logos / banners / watermarks / letterheads - keeps transparency, print-sharp
  branding: { width: 2400, fit: "inside", quality: 90 },
  gallery: { width: 1600, fit: "inside", quality: 82 },
  // printed at A4 - roughly 200 dpi
  certificates: { width: 2400, fit: "inside", quality: 88 },
  "document-templates": { width: 2400, fit: "inside", quality: 88 },
  misc: { width: 1600, fit: "inside", quality: 82 },
};

export const presetFor = (folder: string): ImagePreset => PRESETS[folder] ?? PRESETS.misc;

/** Hard cap on the decoded upload, before any processing (10 MB). */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

const DATA_URI = /^data:image\/[a-z0-9.+-]+;base64,/i;

export const decodeImageDataUri = (dataUri: string): Buffer => {
  const match = DATA_URI.exec(dataUri);
  if (!match) {
    throw new BadRequestError(t({ bn: "ছবি অবশ্যই base64 data URI (data:image/...) হতে হবে", en: "image must be a base64 data URI (data:image/...)" }));
  }
  const buffer = Buffer.from(dataUri.slice(match[0].length), "base64");
  if (buffer.length === 0) throw new BadRequestError(t({ bn: "ছবি খালি", en: "Image is empty" }));
  if (buffer.length > MAX_INPUT_BYTES) {
    throw new BadRequestError(t({ bn: "ছবি ১০ MB-এর বেশি হতে পারবে না", en: "Image must be 10 MB or smaller" }));
  }
  return buffer;
};

/** Resizes per preset and re-encodes as WebP (also strips EXIF/GPS metadata). */
export const processImage = async (input: Buffer, preset: ImagePreset): Promise<Buffer> => {
  try {
    return await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate() // honour EXIF orientation from phone cameras
      .resize({
        width: preset.width,
        height: preset.height,
        fit: preset.fit,
        position: "attention",
        withoutEnlargement: preset.fit === "inside",
      })
      .webp({ quality: preset.quality })
      .toBuffer();
  } catch {
    throw new BadRequestError(t({ bn: "ছবিটি পড়া যায়নি, অন্য ছবি দিন", en: "Could not read the image, please try another one" }));
  }
};
