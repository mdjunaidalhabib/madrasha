import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credentials: { bucket: "test" },
  listImages: vi.fn(),
  deleteObject: vi.fn(),
  references: vi.fn(),
}));
vi.mock("../r2.service", () => ({
  r2CredentialsFromEnv: () => mocks.credentials,
  r2Service: { listImages: mocks.listImages, deleteObject: mocks.deleteObject },
}));
vi.mock("../image-references", () => ({ findReferencedImageKeys: mocks.references }));
import {
  cleanupUnusedImages,
  IMAGE_UPLOAD_GRACE_MS,
  isManagedImageKey,
  queueImageCleanup,
} from "../image-cleanup";

const key = (folder: string, id: number) =>
  `madrasas/demo/${folder}/00000000-0000-4000-8000-${String(id).padStart(12, "0")}.webp`;
const now = Date.now();
const object = (Key: string, age = IMAGE_UPLOAD_GRACE_MS + 1) => ({
  Key,
  LastModified: new Date(now - age),
});

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.listImages.mockResolvedValue({ objects: [] });
  mocks.deleteObject.mockResolvedValue(true);
  mocks.references.mockResolvedValue(new Set());
});

describe("durable image cleanup", () => {
  it("removes abandoned uploads but protects recent drafts, shared and trashed images", async () => {
    const used = key("students", 1),
      abandoned = key("gallery", 2),
      recent = key("gallery", 3);
    mocks.listImages.mockResolvedValueOnce({
      objects: [
        object(used),
        object(abandoned),
        object(recent, 1000),
        object("downloads/installer.exe"),
      ],
    });
    mocks.references.mockResolvedValue(new Set([used]));
    await expect(cleanupUnusedImages(now)).resolves.toEqual({ deleted: 1, failed: 0 });
    expect(mocks.deleteObject).toHaveBeenCalledTimes(1);
    expect(mocks.deleteObject).toHaveBeenCalledWith(mocks.credentials, abandoned);
  });

  it("follows pagination and retries failed deletions on subsequent sweeps", async () => {
    const abandoned = key("gallery", 2);
    mocks.listImages
      .mockResolvedValueOnce({ objects: [], nextToken: "page2" })
      .mockResolvedValueOnce({ objects: [object(abandoned)] });
    mocks.deleteObject.mockResolvedValueOnce(false);
    await expect(cleanupUnusedImages(now)).resolves.toEqual({ deleted: 0, failed: 1 });
    expect(mocks.listImages).toHaveBeenCalledWith(mocks.credentials, "madrasas/", "page2");
    mocks.listImages.mockResolvedValueOnce({ objects: [object(abandoned)] });
    await expect(cleanupUnusedImages(now)).resolves.toEqual({ deleted: 1, failed: 0 });
  });

  it("fails closed on a database error, then recovers on the next sweep", async () => {
    mocks.listImages.mockResolvedValueOnce({ objects: [object(key("gallery", 2))] });
    mocks.references.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(cleanupUnusedImages(now)).rejects.toThrow("database unavailable");
    expect(mocks.deleteObject).not.toHaveBeenCalled();
    await expect(cleanupUnusedImages(now)).resolves.toEqual({ deleted: 0, failed: 0 });
  });

  it("rechecks a file that becomes referenced during the sweep", async () => {
    const abandoned = key("gallery", 2);
    mocks.listImages.mockResolvedValueOnce({ objects: [object(abandoned)] });
    mocks.references.mockResolvedValueOnce(new Set()).mockResolvedValueOnce(new Set([abandoned]));
    await cleanupUnusedImages(now);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("cleans detached files promptly, without deleting files still in use", async () => {
    vi.useFakeTimers();
    const removed = key("students", 4),
      shared = key("branding", 5);
    mocks.references.mockResolvedValue(new Set([shared]));
    queueImageCleanup([removed, shared, removed, "downloads/installer.exe"]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(mocks.deleteObject).toHaveBeenCalledTimes(1);
    expect(mocks.deleteObject).toHaveBeenCalledWith(mocks.credentials, removed);
    vi.useRealTimers();
  });

  it("only manages generated image keys", () => {
    expect(
      isManagedImageKey("platform/website-demo/00000000-0000-4000-8000-000000000001.webp"),
    ).toBe(true);
    expect(isManagedImageKey(key("students", 1))).toBe(true);
    expect(
      isManagedImageKey("platform/document-templates/00000000-0000-4000-8000-000000000001.webp"),
    ).toBe(true);
    expect(isManagedImageKey("madrasas/demo/../other/file.webp")).toBe(false);
    expect(isManagedImageKey("downloads/attendance-connector/setup.exe")).toBe(false);
  });
});
