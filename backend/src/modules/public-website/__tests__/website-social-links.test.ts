import { describe, expect, it, vi } from "vitest";
import { WebsiteService } from "../website.service";
import { toWebsiteSettingsApiDto } from "../website.mapper";
import { normalizeWebsiteSocialUrl } from "../../../../../packages/shared-ui/src/website/socialLinks";

const makeService = () => {
  const repo = { updateMadrasaContactInfo: vi.fn(), upsertSettings: vi.fn() };
  return { repo, service: new WebsiteService(repo as any) };
};

describe("website social links", () => {
  it.each(["01712345678", "+8801712345678", "+880 (1712) 345-678", "০১৭১২৩৪৫৬৭৮"])("turns WhatsApp number %s into a chat link in both client and API", async (url) => {
    const { repo, service } = makeService();
    expect(normalizeWebsiteSocialUrl(url, "whatsapp")).toBe("https://wa.me/8801712345678");
    await service.upsertWebsiteSettings(42, { social_links: [{ platform: "whatsapp", url }] });
    expect(repo.upsertSettings.mock.calls[0][1].socialLinks).toEqual([{ platform: "whatsapp", url: "https://wa.me/8801712345678" }]);
  });

  it.each(["123", "00000000000", "+1234567890123456"])("rejects invalid WhatsApp number %s before writing", async (url) => {
    const { repo, service } = makeService();
    expect(normalizeWebsiteSocialUrl(url, "whatsapp")).toBeNull();
    await expect(service.upsertWebsiteSettings(42, { social_links: [{ platform: "whatsapp", url }] })).rejects.toThrow();
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });

  it("keeps Facebook page and group separate and preserves WhatsApp links", async () => {
    const { repo, service } = makeService();
    const links = [
      { platform: "facebook_page", url: "https://facebook.com/school" },
      { platform: "facebook_group", url: "https://facebook.com/groups/school" },
      { platform: "whatsapp", url: "https://whatsapp.com/channel/updates" },
      { platform: "whatsapp", url: "https://chat.whatsapp.com/invite" },
    ];
    for (const link of links) expect(normalizeWebsiteSocialUrl(link.url, link.platform as any)).toBe(link.url);
    await service.upsertWebsiteSettings(42, { social_links: links });
    expect(repo.upsertSettings.mock.calls[0][1].socialLinks).toEqual(links);
  });

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
