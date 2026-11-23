import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeImageDataUri, MAX_INPUT_BYTES, presetFor, processImage } from "../image-processing";

describe("image limits", () => {
  it.each([["gallery", 250], ["misc", 250], ["branding", 300]] as const)(
    "compresses detailed %s images to at most %i KB",
    async (folder, maxKb) => {
      const pixels = Buffer.alloc(640 * 640 * 3);
      let seed = 42;
      for (let index = 0; index < pixels.length; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        pixels[index] = seed >>> 24;
      }
      const input = await sharp(pixels, { raw: { width: 640, height: 640, channels: 3 } }).png().toBuffer();
      const result = await processImage(input, presetFor(folder));
      expect(result.length).toBeLessThanOrEqual(maxKb * 1024);
      expect((await sharp(result).metadata()).format).toBe("webp");
    },
  );
  it("bounds the longest side of tall gallery images too", async () => {
    const input = await sharp({
      create: { width: 1000, height: 4000, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    const result = await processImage(input, presetFor("gallery"));
    const metadata = await sharp(result).metadata();
    expect([metadata.width, metadata.height]).toEqual([400, 1600]);
  });
  it("rejects oversized and malformed input before processing", () => {
    expect(() =>
      decodeImageDataUri(
        `data:image/png;base64,${"A".repeat(Math.ceil(MAX_INPUT_BYTES / 3) * 4 + 4)}`,
      ),
    ).toThrow();
    expect(() => decodeImageDataUri("data:image/png;base64,!!!!")).toThrow();
    expect(() => decodeImageDataUri("data:image/png;base64,")).toThrow();
  });

  it("compresses detailed photos below the stored profile limit and removes metadata", async () => {
    const pixels = Buffer.alloc(600 * 800 * 3);
    let seed = 42;
    for (let index = 0; index < pixels.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      pixels[index] = seed >>> 24;
    }
    const input = await sharp(pixels, { raw: { width: 600, height: 800, channels: 3 } })
      .withMetadata()
      .png()
      .toBuffer();
    const result = await processImage(input, presetFor("students"));
    const metadata = await sharp(result).metadata();
    expect(result.length).toBeLessThanOrEqual(80 * 1024);
    expect([metadata.width, metadata.height, metadata.format]).toEqual([300, 400, "webp"]);
    expect(metadata.exif).toBeUndefined();
    expect(result.length).toBeLessThan(input.length);
  });

  it("preserves alpha and fails clearly when the output cannot meet the byte cap", async () => {
    const input = await sharp({
      create: { width: 100, height: 100, channels: 4, background: "#ff000080" },
    })
      .png()
      .toBuffer();
    const result = await processImage(input, presetFor("branding"));
    expect((await sharp(result).metadata()).hasAlpha).toBe(true);
    await expect(processImage(input, { ...presetFor("branding"), maxBytes: 1 })).rejects.toThrow(
      /1 KB|0 KB|কমপ্রেস/,
    );
  });

  it("rejects SVG uploads instead of rendering unapproved input formats", async () => {
    await expect(
      processImage(
        Buffer.from('<svg width="10" height="10"><rect width="10" height="10"/></svg>'),
        presetFor("branding"),
      ),
    ).rejects.toThrow();
  });
});
