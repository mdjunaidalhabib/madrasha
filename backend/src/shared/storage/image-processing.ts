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
  maxBytes?: number;
}

/** Profile photo: passport-style 3:4, 300x400 px (~15-30 KB). */
export const PROFILE_PHOTO_PRESET: ImagePreset = {
  width: 300,
  height: 400,
  fit: "cover",
  quality: 80,
  maxBytes: 80 * 1024,
};

const PRESETS: Record<string, ImagePreset> = {
  students: PROFILE_PHOTO_PRESET,
  teachers: PROFILE_PHOTO_PRESET,
  staff: PROFILE_PHOTO_PRESET,
  profile: PROFILE_PHOTO_PRESET,
  // logos / banners / watermarks / letterheads - keeps transparency, print-sharp
  branding: { width: 2400, height: 2400, fit: "inside", quality: 90, maxBytes: 300 * 1024 },
  gallery: { width: 1600, height: 1600, fit: "inside", quality: 82, maxBytes: 250 * 1024 },
  // printed at A4 - roughly 200 dpi
  certificates: { width: 2400, height: 2400, fit: "inside", quality: 88, maxBytes: 1024 * 1024 },
  "document-templates": {
    width: 2400,
    height: 2400,
    fit: "inside",
    quality: 88,
    maxBytes: 1024 * 1024,
  },
  misc: { width: 1600, height: 1600, fit: "inside", quality: 82, maxBytes: 250 * 1024 },
};

export const presetFor = (folder: string): ImagePreset => PRESETS[folder] ?? PRESETS.misc;

/** Hard cap on the decoded upload, before any processing (10 MB). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

const DATA_URI = /^data:image\/[a-z0-9.+-]+;base64,/i;

export const decodeImageDataUri = (dataUri: string): Buffer => {
  if (typeof dataUri !== "string" || dataUri.length > Math.ceil(MAX_INPUT_BYTES / 3) * 4 + 100) {
    throw new BadRequestError(
      t({ bn: "ছবি ১০ MB বা তার কম হতে হবে", en: "Image must be 10 MB or smaller" }),
    );
  }
  const match = DATA_URI.exec(dataUri);
  if (!match) {
    throw new BadRequestError(
      t({
        bn: "ছবি অবশ্যই base64 data URI (data:image/...) হতে হবে",
        en: "image must be a base64 data URI (data:image/...)",
      }),
    );
  }
  const encoded = dataUri.slice(match[0].length);
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new BadRequestError(t({ bn: "ছবির ডেটা সঠিক নয়", en: "Invalid image data" }));
  }
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length === 0) throw new BadRequestError(t({ bn: "ছবি খালি", en: "Image is empty" }));
  if (buffer.length > MAX_INPUT_BYTES) {
    throw new BadRequestError(
      t({ bn: "ছবি ১০ MB-এর বেশি হতে পারবে না", en: "Image must be 10 MB or smaller" }),
    );
  }
  return buffer;
};

/** Resizes per preset and re-encodes as WebP (also strips EXIF/GPS metadata). */
export const processImage = async (input: Buffer, preset: ImagePreset): Promise<Buffer> => {
  try {
    const image = sharp(input, { limitInputPixels: 50_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages ?? 1) > 1) {
      throw new BadRequestError(
        t({
          bn: "শুধু স্থির JPG, PNG বা WebP ছবি দিন",
          en: "Only still JPG, PNG or WebP images are supported",
        }),
      );
    }
    const pipeline = image
      .rotate() // honour EXIF orientation from phone cameras
      .resize({
        width: preset.width,
        height: preset.height,
        fit: preset.fit,
        position: "attention",
        withoutEnlargement: preset.fit === "inside",
      });
    const maxBytes = preset.maxBytes ?? 250 * 1024;
    // Preserve dimensions and transparency. Lower quality in bounded steps;
    // never silently store a file above the advertised limit.
    for (let quality = preset.quality; quality >= 40; quality -= 10) {
      const output = await pipeline.clone().webp({ quality }).toBuffer();
      if (output.length <= maxBytes) return output;
    }
    throw new BadRequestError(
      t({
        bn: `ছবিটি ${Math.round(maxBytes / 1024)} KB-এর মধ্যে কমপ্রেস করা যায়নি। সহজ বা ছোট ছবি দিন।`,
        en: `Image could not be compressed below ${Math.round(maxBytes / 1024)} KB. Choose a smaller or simpler image.`,
      }),
    );
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError(
      t({
        bn: "ছবিটি পড়া যায়নি, অন্য ছবি দিন",
        en: "Could not read the image, please try another one",
      }),
    );
  }
};
