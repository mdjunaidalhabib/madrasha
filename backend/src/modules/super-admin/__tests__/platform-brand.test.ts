import { describe, expect, it, vi, beforeEach } from "vitest";
import sharp from "sharp";

// In-memory stand-in for the singleton platform_brand_settings table.
const db = vi.hoisted(() => ({ row: null as null | { id: number; adminLogo: string | null; updatedAt: Date } }));

vi.mock("../../../shared/database/prisma", () => ({
  prisma: {
    platformBrandSetting: {
      findFirst: vi.fn(async () => db.row),
      create: vi.fn(async ({ data }: any) => (db.row = { id: 1, adminLogo: data.adminLogo, updatedAt: new Date() })),
      update: vi.fn(async ({ data }: any) => (db.row = { ...db.row!, adminLogo: data.adminLogo, updatedAt: new Date() })),
    },
  },
}));

import { platformBrandService, platformLogoVersion } from "../platform-brand.service";

const logoDataUri = async (color: { r: number; g: number; b: number }) => {
  const png = await sharp({ create: { width: 300, height: 200, channels: 4, background: { ...color, alpha: 1 } } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
};

describe("platform (admin panel) logo", () => {
  beforeEach(() => {
    db.row = null;
  });

  it("has no icon and no version while no logo is set (no default)", async () => {
    expect(await platformBrandService.getPublicInfo()).toEqual({ version: null });
    await expect(platformBrandService.getIcon("icon-192.png")).rejects.toThrow();
    expect(await platformBrandService.getAdminLogo()).toEqual({ configured: false });
  });

  it("renders every icon from the saved logo and exposes a version", async () => {
    await platformBrandService.saveAdminLogo(await logoDataUri({ r: 5, g: 150, b: 105 }));
    const info = await platformBrandService.getPublicInfo();
    expect(info.version).toBeTruthy();

    const png = await platformBrandService.getIcon("icon-192.png");
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", 192, 192]);
  });

  it("changes the version when the logo is replaced", async () => {
    await platformBrandService.saveAdminLogo(await logoDataUri({ r: 5, g: 150, b: 105 }));
    const first = (await platformBrandService.getPublicInfo()).version;
    await platformBrandService.saveAdminLogo(await logoDataUri({ r: 200, g: 30, b: 30 }));
    const second = (await platformBrandService.getPublicInfo()).version;
    expect(second).not.toBe(first);
  });

  it("goes back to no icon once the logo is deleted", async () => {
    await platformBrandService.saveAdminLogo(await logoDataUri({ r: 5, g: 150, b: 105 }));
    await platformBrandService.getIcon("favicon-32.png"); // warm the cache
    await platformBrandService.deleteAdminLogo();
    expect(await platformBrandService.getPublicInfo()).toEqual({ version: null });
    await expect(platformBrandService.getIcon("favicon-32.png")).rejects.toThrow();
  });

  it("rejects non-images, empty input and unknown icon names", async () => {
    await expect(platformBrandService.saveAdminLogo("")).rejects.toThrow();
    await expect(platformBrandService.saveAdminLogo("not-a-data-uri")).rejects.toThrow();
    await expect(
      platformBrandService.saveAdminLogo(`data:image/png;base64,${Buffer.from("garbage").toString("base64")}`),
    ).rejects.toThrow();
    await expect(platformBrandService.getIcon("evil.png")).rejects.toThrow();
  });

  it("version is a stable fingerprint of the logo", () => {
    expect(platformLogoVersion("a")).toBe(platformLogoVersion("a"));
    expect(platformLogoVersion("a")).not.toBe(platformLogoVersion("b"));
  });
});
