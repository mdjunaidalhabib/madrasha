import { describe, expect, it, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));

const { creds, resolveStorageCredentials, putObject, deleteObject } = vi.hoisted(() => {
  const creds = {
    accountId: "a".repeat(32),
    accessKeyId: "AK",
    secretAccessKey: "SK",
    bucket: "madrasha-files",
    publicUrl: "https://files.example.com",
  };
  return {
    creds,
    resolveStorageCredentials: vi.fn(async () => creds as typeof creds | null),
    putObject: vi.fn(async (_c: unknown, key: string, _b: Buffer, _t: string) => `https://files.example.com/${key}`),
    deleteObject: vi.fn(async (_c: unknown, _key: string) => true),
  };
});
vi.mock("../../super-admin/platform-settings.service", () => ({
  platformSettingsService: { resolveStorageCredentials: () => resolveStorageCredentials() },
}));

vi.mock("../../../shared/storage/r2.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/storage/r2.service")>();
  return { ...actual, r2Service: { putObject, deleteObject } };
});

import { uploadService } from "../upload.service";
import { safeSegment, tenantPrefix } from "../../../shared/storage/r2.service";
import { PROFILE_PHOTO_PRESET } from "../../../shared/storage/image-processing";

const pngDataUri = async (width: number, height: number) => {
  const buf = await sharp({ create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
};

const tenant = { madrasaId: 7, slug: "darul-uloom" };

beforeEach(() => {
  putObject.mockClear();
  deleteObject.mockClear();
  resolveStorageCredentials.mockResolvedValue(creds);
});

describe("upload to R2", () => {
  it("stores a profile photo as 300x400 WebP under the madrasa's own folder", async () => {
    const result = await uploadService.uploadImage(tenant, { image: await pngDataUri(1200, 900), folder: "students" });

    expect(result.uploaded).toBe(true);
    const [, key, body, contentType] = putObject.mock.calls[0] as unknown as [unknown, string, Buffer, string];
    expect(key).toMatch(/^madrasas\/darul-uloom\/students\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
    expect(contentType).toBe("image/webp");
    const meta = await sharp(body).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([PROFILE_PHOTO_PRESET.width, PROFILE_PHOTO_PRESET.height]);
    expect(result.public_id).toBe(key);
    expect(result.url).toBe(`https://files.example.com/${key}`);
  });

  it("only shrinks other images, keeping the aspect ratio", async () => {
    await uploadService.uploadImage(tenant, { image: await pngDataUri(3200, 1600), folder: "gallery" });
    const body = (putObject.mock.calls[0] as unknown as [unknown, string, Buffer])[2];
    const meta = await sharp(body).metadata();
    expect([meta.width, meta.height]).toEqual([1600, 800]);

    putObject.mockClear();
    await uploadService.uploadImage(tenant, { image: await pngDataUri(200, 100), folder: "gallery" });
    const small = await sharp((putObject.mock.calls[0] as unknown as [unknown, string, Buffer])[2]).metadata();
    expect([small.width, small.height]).toEqual([200, 100]);
  });

  it("falls back to misc for unknown folders and reports when storage isn't configured", async () => {
    await uploadService.uploadImage(tenant, { image: await pngDataUri(10, 10), folder: "../../etc" });
    expect((putObject.mock.calls[0] as unknown as [unknown, string])[1]).toMatch(/^madrasas\/darul-uloom\/misc\//);

    resolveStorageCredentials.mockResolvedValue(null);
    await expect(uploadService.uploadImage(tenant, { image: await pngDataUri(10, 10) })).resolves.toMatchObject({
      uploaded: false,
      configured: false,
    });
  });

  it("rejects non-images", async () => {
    await expect(uploadService.uploadImage(tenant, { image: "data:image/png;base64,bm90IGFuIGltYWdl" })).rejects.toThrow();
    await expect(uploadService.uploadImage(tenant, { image: "https://x/y.png" })).rejects.toThrow();
  });
});

describe("delete from R2", () => {
  it("deletes inside the madrasa's own prefix", async () => {
    await expect(
      uploadService.deleteImage(tenant, { public_id: "madrasas/darul-uloom/students/2026/10/x.webp" }),
    ).resolves.toEqual({ deleted: true });
    expect(deleteObject).toHaveBeenCalledWith(creds, "madrasas/darul-uloom/students/2026/10/x.webp");
  });

  it("refuses another madrasa's files and path tricks", async () => {
    await expect(uploadService.deleteImage(tenant, { public_id: "madrasas/other/students/x.webp" })).rejects.toThrow();
    await expect(
      uploadService.deleteImage(tenant, { public_id: "madrasas/darul-uloom/../other/x.webp" }),
    ).rejects.toThrow();
    // prefix must end at a "/" boundary: "darul-uloom-2" is a different madrasa
    await expect(
      uploadService.deleteImage({ madrasaId: 8, slug: "darul-uloom" }, { public_id: "madrasas/darul-uloom-2/x.webp" }),
    ).rejects.toThrow();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("ignores ids outside madrasas/", async () => {
    await expect(uploadService.deleteImage(tenant, { public_id: "madrasha/students/abc" })).resolves.toEqual({ deleted: false });
    expect(deleteObject).not.toHaveBeenCalled();
  });
});

describe("key helpers", () => {
  it("sanitises slugs so they can't escape the prefix", () => {
    expect(safeSegment("../Evil/Slug")).toBe("evil-slug");
    expect(tenantPrefix("Darul Uloom")).toBe("madrasas/darul-uloom/");
    expect(safeSegment("")).toBe("unknown");
  });
});
