import { describe, expect, it, vi } from "vitest";
import { WebsiteService } from "../website.service";
import { toWebsiteSettingsApiDto } from "../website.mapper";

const makeService = () => {
  const repo = { updateMadrasaContactInfo: vi.fn(), upsertSettings: vi.fn() };
  return { repo, service: new WebsiteService(repo as any) };
};

describe("website social links", () => {
  it("normalizes and stores a replacement list scoped to the institution", async () => {
    const { repo, service } = makeService();
    await service.upsertWebsiteSettings(42, { social_links: [{ platform: "telegram", label: " Updates ", url: " t.me/school " }, { platform: "other", url: "https://example.com/community" }] });
    const data = repo.upsertSettings.mock.calls[0][1];
    expect(repo.upsertSettings.mock.calls[0][0]).toBe(42);
    expect(data.socialLinks).toEqual([{ platform: "telegram", label: "Updates", url: "https://t.me/school" }, { platform: "other", url: "https://example.com/community" }]);
    expect(toWebsiteSettingsApiDto(data).social_links).toEqual(data.socialLinks);
  });

  it("persists deletion of the final link without falling back to legacy links", async () => {
    const { repo, service } = makeService();
    await service.upsertWebsiteSettings(42, { social_links: [] });
    expect(repo.upsertSettings.mock.calls[0][1].socialLinks).toEqual([]);
    expect(toWebsiteSettingsApiDto({ socialLinks: [], facebookUrl: "https://facebook.com/old" }).social_links).toEqual([]);
  });

  it("preserves the existing list when a legacy client omits it", async () => {
    const { repo, service } = makeService();
    await service.upsertWebsiteSettings(42, { facebook_url: "https://facebook.com/school" });
    expect(repo.upsertSettings.mock.calls[0][1]).not.toHaveProperty("socialLinks");
    expect(toWebsiteSettingsApiDto({ facebookUrl: "https://facebook.com/school" }).social_links).toBeNull();
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "ftp://example.com", "https://user:pass@example.com", "not a link", "https://"]) ("rejects unsafe or invalid URL %s before any write", async (url) => {
    const { repo, service } = makeService();
    await expect(service.upsertWebsiteSettings(42, { social_links: [{ platform: "other", url }] })).rejects.toThrow();
    expect(repo.updateMadrasaContactInfo).not.toHaveBeenCalled();
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });

  it.each([null, {}, [{ platform: "unknown", url: "https://example.com" }], Array.from({ length: 21 }, () => ({ platform: "other", url: "https://example.com" }))])("rejects invalid lists", async (social_links) => {
    const { repo, service } = makeService();
    await expect(service.upsertWebsiteSettings(42, { social_links } as any)).rejects.toThrow();
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });
});
