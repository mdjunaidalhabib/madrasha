import { describe, expect, it, vi } from "vitest";
import { toWebsiteSettingsApiDto } from "../website.mapper";
import { WebsiteService } from "../website.service";

describe("website theme_key", () => {
  it("maps valid theme, falls back to classic for null/unknown", () => {
    expect(toWebsiteSettingsApiDto({ themeKey: "modern" }).theme_key).toBe("modern");
    expect(toWebsiteSettingsApiDto({ themeKey: null }).theme_key).toBe("classic");
    expect(toWebsiteSettingsApiDto({ themeKey: "weird" }).theme_key).toBe("classic");
  });

  const makeService = () => {
    const repo = { updateMadrasaContactInfo: vi.fn(), upsertSettings: vi.fn() };
    return { repo, service: new WebsiteService(repo as any) };
  };

  it("stores a valid theme, defaults when missing", async () => {
    const { repo, service } = makeService();
    await service.upsertWebsiteSettings(1, { theme_key: "minimal" });
    expect(repo.upsertSettings.mock.calls[0][1].themeKey).toBe("minimal");
    await service.upsertWebsiteSettings(1, {});
    expect(repo.upsertSettings.mock.calls[1][1].themeKey).toBe("classic");
  });

  it("rejects an unknown theme", async () => {
    const { repo, service } = makeService();
    await expect(service.upsertWebsiteSettings(1, { theme_key: "neon" })).rejects.toThrow("Invalid theme");
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });
});
