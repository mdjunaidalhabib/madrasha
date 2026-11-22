import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/subscription/subscription-state", () => ({ getSubscriptionState: vi.fn(async () => "ACTIVE") }));
vi.mock("../../classPanal/class-panel.service", () => ({ classPanelService: { listDivisions: vi.fn() } }));
import { WebsiteService } from "../website.service";

function repository(overrides = {}) {
  return {
    findPublicMadrasaBySlug: vi.fn(async () => ({
      id: 42, slug: "school", name: "School", address: "Dhaka", reportLogo: "logo.png",
      isActive: 1, websiteStatus: "active", institutionType: "MADRASA", ...overrides,
    })),
    findSettings: vi.fn(async () => ({ isPublished: 1 })),
  };
}

describe("public institution branding", () => {
  it("returns name, address and saved logo without loading website collections", async () => {
    const result = await new WebsiteService(repository() as any).getPublicBrand("school");
    expect(result).toMatchObject({ slug: "school", name: "School", address: "Dhaka", logo_url: "logo.png" });
    expect(Object.keys(result).sort()).toEqual(["address", "institution", "logo_url", "name", "slug"]);
  });

  it.each([{ isActive: 0 }, { websiteStatus: "disabled" }])("rejects unavailable institutions: %j", async (overrides) => {
    await expect(new WebsiteService(repository(overrides) as any).getPublicBrand("school")).rejects.toThrow();
  });

  it("rejects unpublished sites", async () => {
    const repo = repository();
    repo.findSettings.mockResolvedValue({ isPublished: 0 });
    await expect(new WebsiteService(repo as any).getPublicBrand("school")).rejects.toThrow();
  });

  it("rejects unknown institutions", async () => {
    const repo = repository();
    repo.findPublicMadrasaBySlug.mockResolvedValue(null as any);
    await expect(new WebsiteService(repo as any).getPublicBrand("missing")).rejects.toThrow();
  });
});
