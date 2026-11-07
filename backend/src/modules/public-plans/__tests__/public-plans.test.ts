import { afterEach, describe, expect, it, vi } from "vitest";
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("../../../shared/database/prisma", () => ({ prisma: { plan: { findMany } } }));
import { PublicPlansRepository } from "../public-plans.repository";
import { PublicPlansService, publicPlansService } from "../public-plans.service";
import { getPublicPlans } from "../public-plans.controller";
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("public plans", () => {
  it("queries only visible active plans ordered by sortOrder, selecting public fields", async () => {
    findMany.mockResolvedValue([]);
    await new PublicPlansRepository().findVisible();
    const query = findMany.mock.calls.at(-1)![0];
    expect(query.where).toEqual({ isActive: 1, deletedAt: null, showOnLanding: 1 });
    expect(query.orderBy).toEqual([{ sortOrder: "asc" }, { id: "asc" }]);
    expect(query.select).not.toHaveProperty("subscriptions");
    expect(query.select).not.toHaveProperty("madrasaId");
  });
  it("refreshes a hidden plan after 60 seconds and strips unexpected private fields", async () => {
    vi.useFakeTimers();
    const repo = {
      findVisible: vi
        .fn()
        .mockResolvedValueOnce([
          { id: 1, name: "Plus", price: "10000", madrasaId: 99, subscriptions: [{ id: 42 }] },
        ])
        .mockResolvedValueOnce([]),
    };
    const service = new PublicPlansService(repo as any);
    const first = await service.list();
    expect(first.plans[0]).toMatchObject({ id: 1, name: "Plus", price: 10000 });
    expect(first.plans[0]).not.toHaveProperty("madrasaId");
    expect(first.plans[0]).not.toHaveProperty("subscriptions");
    expect(first).toMatchObject({
      refundDays: 30,
      customDomain: { firstYear: 3500, renewal: 2500 },
      maxPlanStudents: 2000,
    });
    expect(first.includes).toHaveLength(4);
    expect(first.excludes).toHaveLength(3);
    vi.advanceTimersByTime(59_999);
    expect(service.cacheAgeSeconds()).toBe(60);
    expect((await service.list()).plans).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect((await service.list()).plans).toEqual([]);
    expect(repo.findVisible).toHaveBeenCalledTimes(2);
  });
  it("sets a public cache header and removes the global no-cache headers", async () => {
    vi.spyOn(publicPlansService, "list").mockResolvedValue({ plans: [] } as any);
    const res = { removeHeader: vi.fn(), setHeader: vi.fn(), json: vi.fn() };
    await getPublicPlans({} as any, res as any, vi.fn());
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=60");
    expect(res.removeHeader).toHaveBeenCalledWith("Pragma");
    expect(res.removeHeader).toHaveBeenCalledWith("Expires");
  });
});
