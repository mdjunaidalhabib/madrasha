import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../database/prisma", () => ({
  prisma: { madrasa: { findFirst: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("../../config/env", () => ({ env: { subscriptionEnforcement: false } }));
vi.mock("../../logger/logger", () => ({ logger: { error: vi.fn() } }));
import { prisma } from "../../database/prisma";
import { tenantMiddleware, tenantPlanAccessMiddleware } from "../tenant.middleware";

describe("tenant access on custom admin domains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.madrasa.findUnique).mockResolvedValue({
      id: 12,
      slug: "jamia",
      name: "Jamia",
      isActive: 1,
      deletedAt: null,
    } as any);
  });
  const response = () => {
    const res: any = { json: vi.fn() };
    res.status = vi.fn(() => res);
    return res;
  };
  it.each([tenantMiddleware, tenantPlanAccessMiddleware])(
    "pins tenant to the domain despite an explicit foreign slug",
    async (middleware) => {
      vi.mocked(prisma.madrasa.findFirst).mockResolvedValue({ slug: "jamia" } as any);
      const req: any = {
        headers: {
          origin: "https://admin.jamia.com",
          host: "api.platform.com",
          "x-madrasa-slug": "other",
        },
        params: {},
        query: { slug: "other" },
      };
      const next = vi.fn();
      await middleware(req, response(), next);
      expect(prisma.madrasa.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: "jamia" } }),
      );
      expect(req.tenant).toEqual({ madrasa_id: 12, slug: "jamia" });
      expect(next).toHaveBeenCalledOnce();
    },
  );
  it("preserves code login on the shared domain", async () => {
    vi.mocked(prisma.madrasa.findFirst).mockResolvedValue(null);
    const req: any = {
      headers: { origin: "https://admin.platform.com", "x-madrasa-slug": "jamia" },
      params: {},
      query: {},
    };
    const next = vi.fn();
    await tenantMiddleware(req, response(), next);
    expect(req.tenant.slug).toBe("jamia");
    expect(next).toHaveBeenCalledOnce();
  });
  it("still blocks a deleted tenant", async () => {
    vi.mocked(prisma.madrasa.findFirst).mockResolvedValue({ slug: "jamia" } as any);
    vi.mocked(prisma.madrasa.findUnique).mockResolvedValue({
      id: 12,
      slug: "jamia",
      deletedAt: new Date(),
      isActive: 0,
    } as any);
    const res = response(),
      next = vi.fn();
    await tenantMiddleware({ headers: { host: "admin.jamia.com" } } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(next).not.toHaveBeenCalled();
  });
});
