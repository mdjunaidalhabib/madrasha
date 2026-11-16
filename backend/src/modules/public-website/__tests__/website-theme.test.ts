import { describe, expect, it, vi } from "vitest";
import { toWebsiteSettingsApiDto } from "../website.mapper";
import { WebsiteService } from "../website.service";
import { WEBSITE_THEME_KEYS } from "../website.constants";
import { DEFAULT_WEBSITE_TEMPLATE, websiteTemplateSchema } from "../website-template.schema";
import { getWebsiteTemplate } from "../website-template.service";

describe("website theme_key", () => {
  it("maps valid themes and falls back to modern for null, unknown or retired themes", () => {
    expect(toWebsiteSettingsApiDto({ themeKey: "modern" }).theme_key).toBe("modern");
    for (const themeKey of [null, "weird", "classic", "minimal"]) {
      expect(toWebsiteSettingsApiDto({ themeKey }).theme_key).toBe("modern");
    }
  });

  const makeService = () => {
    const repo = { updateMadrasaContactInfo: vi.fn(), upsertSettings: vi.fn() };
    return { repo, service: new WebsiteService(repo as any) };
  };

  it("stores a valid theme, defaults when missing", async () => {
    const { repo, service } = makeService();
    await service.upsertWebsiteSettings(1, { theme_key: "heritage" });
    expect(repo.upsertSettings.mock.calls[0][1].themeKey).toBe("heritage");
    await service.upsertWebsiteSettings(1, {});
    expect(repo.upsertSettings.mock.calls[1][1].themeKey).toBe("modern");
  });

  it("rejects an unknown theme", async () => {
    const { repo, service } = makeService();
    await expect(service.upsertWebsiteSettings(1, { theme_key: "neon" })).rejects.toThrow("থিম সঠিক নয়");
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });

  it.each(WEBSITE_THEME_KEYS)("accepts %s in admin settings, public responses and demo templates", async (theme) => {
    const { repo, service } = makeService();
    await service.upsertWebsiteSettings(42, { theme_key: theme });
    expect(repo.upsertSettings.mock.calls[0][1].themeKey).toBe(theme);
    expect(toWebsiteSettingsApiDto({ themeKey: theme }).theme_key).toBe(theme);
    expect(websiteTemplateSchema.parse({ ...DEFAULT_WEBSITE_TEMPLATE, settings: { ...DEFAULT_WEBSITE_TEMPLATE.settings, themeKey: theme } }).settings.themeKey).toBe(theme);
  });
});

describe("super admin institution theme", () => {
  const makeService = () => {
    const repo = {
      findWebsiteInstitution: vi.fn().mockResolvedValue({ id: 42 }),
      findSettings: vi.fn().mockResolvedValue({ themeKey: "campus", heroTitle: "Keep this" }),
      upsertSettings: vi.fn(),
    };
    return { repo, service: new WebsiteService(repo as any) };
  };

  it("reads the saved theme and defaults missing settings to modern", async () => {
    const { repo, service } = makeService();
    expect(await service.getWebsiteThemeBySuperAdmin(42)).toBe("campus");
    repo.findSettings.mockResolvedValueOnce(null as any);
    expect(await service.getWebsiteThemeBySuperAdmin(42)).toBe("modern");
  });

  it.each(WEBSITE_THEME_KEYS)("updates only the theme to %s for the requested institution", async (theme) => {
    const { repo, service } = makeService();
    expect(await service.updateWebsiteThemeBySuperAdmin(42, theme)).toBe(theme);
    expect(repo.upsertSettings).toHaveBeenCalledTimes(1);
    expect(repo.upsertSettings).toHaveBeenCalledWith(42, { themeKey: theme }, { madrasaId: 42, themeKey: theme });
  });

  it.each([0, -1, 1.2, NaN, Infinity])("rejects invalid institution ID %s", async (id) => {
    const { repo, service } = makeService();
    await expect(service.updateWebsiteThemeBySuperAdmin(id, "heritage")).rejects.toThrow("Invalid institution ID");
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });

  it("rejects missing or deleted institutions and invalid themes", async () => {
    const { repo, service } = makeService();
    repo.findWebsiteInstitution.mockResolvedValue(null as any);
    await expect(service.updateWebsiteThemeBySuperAdmin(42, "heritage")).rejects.toThrow("Institution not found");
    await expect(service.updateWebsiteThemeBySuperAdmin(42, "neon")).rejects.toThrow();
    await expect(service.updateWebsiteThemeBySuperAdmin(42, undefined)).rejects.toThrow();
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });

  it.each(["classic", "minimal"])("rejects retired theme %s in settings, super admin and templates", async (theme) => {
    const { repo, service } = makeService();
    await expect(service.upsertWebsiteSettings(42, { theme_key: theme })).rejects.toThrow();
    await expect(service.updateWebsiteThemeBySuperAdmin(42, theme)).rejects.toThrow();
    expect(websiteTemplateSchema.safeParse({ ...DEFAULT_WEBSITE_TEMPLATE, settings: { ...DEFAULT_WEBSITE_TEMPLATE.settings, themeKey: theme } }).success).toBe(false);
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });

  it.each(["classic", "minimal"])("loads saved demos using retired %s as modern without losing content", async (themeKey) => {
    const content = structuredClone(DEFAULT_WEBSITE_TEMPLATE);
    content.settings.themeKey = themeKey as any;
    content.settings.heroTitle = "Preserve the saved headline";
    const db = { platformWebsiteTemplate: { findUnique: vi.fn().mockResolvedValue({ content, updatedAt: null }) } };
    const loaded = await getWebsiteTemplate(db as any);
    expect(loaded.content.settings.themeKey).toBe("modern");
    expect(loaded.content.settings.heroTitle).toBe("Preserve the saved headline");
    expect(loaded.content.pages).toEqual(content.pages);
    expect(content.settings.themeKey).toBe(themeKey);
  });
});
