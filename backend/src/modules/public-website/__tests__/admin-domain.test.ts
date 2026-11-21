import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../shared/database/prisma", () => ({ prisma: { madrasa: { findFirst: vi.fn() } } }));
import { prisma } from "../../../shared/database/prisma";
import { resolveAdminDomain } from "../admin-domain";

describe("admin domain branding", () => {
  beforeEach(() => vi.clearAllMocks());
  const response = () => ({ setHeader: vi.fn(), json: vi.fn() });
  it("resolves the browser domain when the API has its own hostname", async () => {
    vi.mocked(prisma.madrasa.findFirst).mockResolvedValue({
      slug: "jamia",
      name: "Jamia",
      reportLogo: "logo.png",
    } as any);
    const res = response();
    await resolveAdminDomain(
      { headers: { origin: "https://ADMIN.JAMIA.COM", host: "api.platform.com" } } as any,
      res as any,
      vi.fn(),
    );
    expect(prisma.madrasa.findFirst).toHaveBeenCalledWith({
      where: { adminDomain: "admin.jamia.com", deletedAt: null },
      select: { slug: true, name: true, reportLogo: true },
    });
    expect(res.json).toHaveBeenCalledWith({
      data: { slug: "jamia", name: "Jamia", logo: "logo.png" },
    });
  });
  it("keeps shared login for an unconnected domain", async () => {
    vi.mocked(prisma.madrasa.findFirst).mockResolvedValue(null);
    const res = response();
    await resolveAdminDomain(
      { headers: { host: "admin.platform.com" } } as any,
      res as any,
      vi.fn(),
    );
    expect(res.json).toHaveBeenCalledWith({ data: null });
  });
  it("propagates lookup errors instead of silently showing a different brand", async () => {
    vi.mocked(prisma.madrasa.findFirst).mockRejectedValue(new Error("offline"));
    const next = vi.fn(),
      res = response();
    await resolveAdminDomain({ headers: { host: "admin.jamia.com" } } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.json).not.toHaveBeenCalled();
  });
});
