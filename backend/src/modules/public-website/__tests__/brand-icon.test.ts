import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { BRAND_ICON_SPECS, decodePreviewImage, renderBrandIcon, renderBrandIconPreviews } from "../brand-icon.service";

// A wide, non-square logo with a transparent background.
const makeLogo = () =>
  sharp({ create: { width: 400, height: 200, channels: 4, background: { r: 5, g: 150, b: 105, alpha: 1 } } })
    .png()
    .toBuffer();

describe("brand icons rendered from the madrasa logo", () => {
  it("produces every icon file as a PNG at the expected square size", async () => {
    const logo = await makeLogo();
    for (const [file, spec] of Object.entries(BRAND_ICON_SPECS)) {
      const png = await renderBrandIcon(logo, file);
      const meta = await sharp(png).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(spec.size);
      expect(meta.height).toBe(spec.size);
    }
  });

  it("keeps 'any' icons transparent but gives apple-touch / maskable a solid tile", async () => {
    const logo = await makeLogo();
    const corner = async (file: string) => {
      const { data } = await sharp(await renderBrandIcon(logo, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return data[3]; // alpha of the top-left pixel
    };
    expect(await corner("icon-192.png")).toBe(0);
    expect(await corner("apple-touch-icon.png")).toBe(255);
    expect(await corner("maskable-512.png")).toBe(255);
  });

  it("rejects unknown icon names", async () => {
    await expect(renderBrandIcon(await makeLogo(), "evil.png")).rejects.toThrow();
  });

  it("previews every icon the logo produces as PNG data URIs", async () => {
    const previews = await renderBrandIconPreviews(await makeLogo());
    expect(previews.map((p) => p.file).sort()).toEqual(Object.keys(BRAND_ICON_SPECS).sort());
    for (const p of previews) {
      expect(p.src.startsWith("data:image/png;base64,")).toBe(true);
      const meta = await sharp(Buffer.from(p.src.split(",")[1], "base64")).metadata();
      expect(meta.width).toBe(p.size);
    }
  });

  it("rejects a missing / unreadable preview image with a 400-style error", () => {
    expect(() => decodePreviewImage(undefined)).toThrow();
    expect(() => decodePreviewImage("not-an-image")).toThrow();
  });
});
