import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { platformSettingsService } from "../../super-admin/platform-settings.service";
import { r2Service } from "../../../shared/storage/r2.service";
import { DEFAULT_WEBSITE_TEMPLATE, websiteTemplateSchema } from "../website-template.schema";
import {
  personalizeWebsiteTemplate,
  provisionWebsiteOnTx,
  saveWebsiteTemplate,
  uploadWebsiteTemplateImage,
} from "../website-template.service";

const makeTx = () => ({
  platformWebsiteTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
  madrasa: { findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "নতুন মাদ্রাসা" }) },
  websiteSettings: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  websitePage: { createMany: vi.fn() },
  websiteNotice: { createMany: vi.fn() },
  websiteSlide: { createMany: vi.fn() },
  websiteGallery: { createMany: vi.fn() },
  websiteCommitteeMember: { createMany: vi.fn() },
  websiteVideo: { createMany: vi.fn() },
});

describe("default website template", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects invalid image payloads and explains missing cloud storage", async () => {
    await expect(uploadWebsiteTemplateImage(null)).rejects.toThrow("Image is required");
    await expect(uploadWebsiteTemplateImage("https://example.com/image.png")).rejects.toThrow();
    vi.spyOn(platformSettingsService, "resolveStorageCredentials").mockResolvedValue(null);
    await expect(uploadWebsiteTemplateImage("data:image/png;base64,aGVsbG8=")).rejects.toThrow("Cloud storage is not configured");
  });

  it("processes uploaded images and stores them in a platform-owned prefix", async () => {
    const credentials = { bucket: "test-only" } as any;
    vi.spyOn(platformSettingsService, "resolveStorageCredentials").mockResolvedValue(credentials);
    const put = vi.spyOn(r2Service, "putObject").mockResolvedValue("https://example.com/demo.webp");
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#0f766e" } }).png().toBuffer();
    expect(await uploadWebsiteTemplateImage(`data:image/png;base64,${png.toString("base64")}`)).toEqual({ url: "https://example.com/demo.webp" });
    expect(put).toHaveBeenCalledWith(credentials, expect.stringMatching(/^platform\/website-demo\/.+\.webp$/), expect.any(Buffer), "image/webp");
    expect((await sharp(put.mock.calls[0][2]).metadata()).format).toBe("webp");
  });
  it("ships a valid complete starter with intentional demo copy", () => {
    expect(websiteTemplateSchema.safeParse(DEFAULT_WEBSITE_TEMPLATE).success).toBe(true);
    expect(DEFAULT_WEBSITE_TEMPLATE.pages.map((row) => row.pageKey)).toEqual([
      "about",
      "admission",
      "contact",
    ]);
    expect(DEFAULT_WEBSITE_TEMPLATE.slides.length).toBeGreaterThan(0);
    expect(DEFAULT_WEBSITE_TEMPLATE.gallery.length).toBeGreaterThan(0);
  });

  it("personalizes a copy without mutating the global template or link destinations", () => {
    const template = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
    template.slides[0].buttonLink = "https://example.com/{{institution_name}}";
    const result = personalizeWebsiteTemplate(template, "আমাদের প্রতিষ্ঠান");
    expect(result.pages[0].content).toContain("আমাদের প্রতিষ্ঠান");
    expect(result.settings.noticeBarText).toContain("আমাদের প্রতিষ্ঠান");
    expect(result.slides[0].buttonLink).toBe(template.slides[0].buttonLink);
    expect(template.pages[0].content).toContain("{{institution_name}}");
    expect(
      personalizeWebsiteTemplate(template, "ক".repeat(250)).settings.heroTitle.length,
    ).toBeLessThanOrEqual(190);
  });

  it("copies the latest saved template into tenant-scoped records", async () => {
    const tx = makeTx();
    const custom = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
    custom.settings.heroTitle = "সুপার অ্যাডমিনের নতুন ডেমো";
    custom.videos = [
      { title: "পরিচিতি", videoUrl: "https://example.com/demo.mp4", sortOrder: 1, isPublished: 0 },
    ];
    tx.platformWebsiteTemplate.findUnique.mockResolvedValue({ content: custom } as never);
    await provisionWebsiteOnTx(tx as any, 42);
    expect(tx.websiteSettings.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ madrasaId: 42, heroTitle: custom.settings.heroTitle })],
      skipDuplicates: true,
    });
    for (const table of [
      tx.websitePage,
      tx.websiteNotice,
      tx.websiteSlide,
      tx.websiteGallery,
      tx.websiteCommitteeMember,
      tx.websiteVideo,
    ]) {
      expect(table.createMany).toHaveBeenCalledTimes(1);
      expect(
        table.createMany.mock.calls[0][0].data.every(
          (row: { madrasaId: number }) => row.madrasaId === 42,
        ),
      ).toBe(true);
    }
    expect(tx.websitePage.createMany.mock.calls[0][0].data[0].content).toContain("নতুন মাদ্রাসা");
  });

  it("does not re-add deleted sections or overwrite an existing website", async () => {
    const tx = makeTx();
    tx.websiteSettings.createMany.mockResolvedValue({ count: 0 });
    await provisionWebsiteOnTx(tx as any, 42);
    expect(tx.websitePage.createMany).not.toHaveBeenCalled();
    expect(tx.websiteNotice.createMany).not.toHaveBeenCalled();
    expect(tx.websiteSlide.createMany).not.toHaveBeenCalled();
  });

  it("respects disabled automatic setup", async () => {
    const tx = makeTx();
    tx.platformWebsiteTemplate.findUnique.mockResolvedValue({
      content: { ...DEFAULT_WEBSITE_TEMPLATE, enabled: false },
    } as never);
    await provisionWebsiteOnTx(tx as any, 42);
    expect(tx.madrasa.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.websiteSettings.createMany).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "//evil.example/a.png", "data:text/html,unsafe"])(
    "rejects unsafe media and links: %s",
    async (value) => {
      const input = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
      input.slides[0].imageUrl = value;
      await expect(saveWebsiteTemplate(input)).rejects.toThrow("slides.0.imageUrl");
      input.slides[0].imageUrl = "/images/valid.svg";
      input.slides[0].buttonLink = value;
      await expect(saveWebsiteTemplate(input)).rejects.toThrow("slides.0.buttonLink");
    },
  );

  it("rejects unknown fields, duplicate page keys, invalid themes and excessive items", () => {
    expect(
      websiteTemplateSchema.safeParse({ ...DEFAULT_WEBSITE_TEMPLATE, madrasaId: 12 }).success,
    ).toBe(false);
    expect(
      websiteTemplateSchema.safeParse({
        ...DEFAULT_WEBSITE_TEMPLATE,
        pages: [DEFAULT_WEBSITE_TEMPLATE.pages[0], DEFAULT_WEBSITE_TEMPLATE.pages[0]],
      }).success,
    ).toBe(false);
    expect(
      websiteTemplateSchema.safeParse({
        ...DEFAULT_WEBSITE_TEMPLATE,
        settings: { ...DEFAULT_WEBSITE_TEMPLATE.settings, themeKey: "unknown" },
      }).success,
    ).toBe(false);
    expect(
      websiteTemplateSchema.safeParse({
        ...DEFAULT_WEBSITE_TEMPLATE,
        slides: Array(21).fill(DEFAULT_WEBSITE_TEMPLATE.slides[0]),
      }).success,
    ).toBe(false);
  });
});
