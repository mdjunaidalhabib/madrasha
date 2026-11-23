import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../../shared/storage", () => ({ storageProvider: {} }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn() }));
vi.mock("../../super-admin/vendor-promo.service", () => ({ vendorPromoService: {} }));

import { SettingsService } from "../settings.service";
import type { SettingsRepository } from "../settings.repository";

function setup() {
  let layout: Record<string, unknown> = { name_font_size: 30, footer_text: "Existing footer" };
  const repository = {
    findBranding: vi.fn(async () => ({ reportBrandLayout: layout })),
    updateBranding: vi.fn(async (_tenant: number, data: { reportBrandLayout?: Record<string, unknown> }) => {
      if (data.reportBrandLayout) layout = data.reportBrandLayout;
    }),
  };
  return { repository, service: new SettingsService(repository as unknown as SettingsRepository) };
}

describe("report signature caption", () => {
  it("saves a trimmed tenant caption, preserves other settings and reads it back", async () => {
    const { repository, service } = setup();
    await service.updateBranding(7, 4, { report_brand_layout: { signature_text: "  পরিচালকের স্বাক্ষর  " } });
    expect(repository.updateBranding).toHaveBeenCalledWith(7, expect.objectContaining({
      reportBrandLayout: expect.objectContaining({ signature_text: "পরিচালকের স্বাক্ষর", name_font_size: 30, footer_text: "Existing footer" }),
    }));
    expect((await service.getBranding(7)).report_brand_layout.signature_text).toBe("পরিচালকের স্বাক্ষর");
  });

  it.each([null, "", "   "])("clears %j back to the default caption", async (value) => {
    const { service } = setup();
    await service.updateBranding(7, 4, { report_brand_layout: { signature_text: value } });
    expect((await service.getBranding(7)).report_brand_layout.signature_text).toBeNull();
  });

  it.each([42, {}, "x".repeat(151)])("rejects invalid or excessive text before saving", async (value) => {
    const { repository, service } = setup();
    await expect(service.updateBranding(7, 4, { report_brand_layout: { signature_text: value as string } })).rejects.toThrow();
    expect(repository.updateBranding).not.toHaveBeenCalled();
  });
});
