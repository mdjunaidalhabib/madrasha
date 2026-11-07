import { describe, expect, it, vi } from "vitest";
const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../../../shared/database/prisma", () => ({ prisma: { $transaction: transaction } }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn() }));
import { PlansRepository } from "../plans.repository";
import { PlansService } from "../plans.service";
import { parsePlanFields } from "../plans.validation";
import { logActivity } from "../../../shared/utils/activity.util";
import { PLAN_SEEDS } from "../../../../prisma/data/plans.seed";

describe("super-admin plan controls", () => {
  it("reads reset defaults from the seed catalogue and leaves custom plans alone", async () => {
    const repo = { findActiveById: vi.fn(async () => ({ name: "Plus" })) };
    const service = new PlansService(repo as any);
    expect(await service.getDefaults(4)).toEqual(PLAN_SEEDS[3]);
    repo.findActiveById.mockResolvedValue({ name: "Custom" });
    expect(await service.getDefaults(99)).toBeNull();
  });
  it.each([
    { price: -1 },
    { renewalPrice: 6000 },
    { extraStudentPriceFirst: -1 },
    { accentColor: "red" },
    { price: "oops" },
    { sortOrder: 1.5 },
  ])("rejects invalid prices, colors and ordering: %o", (change) => {
    expect(() => parsePlanFields({ ...PLAN_SEEDS[1], ...change })).toThrow();
  });
  it("accepts new fields and aliases while preserving omitted values on update", () => {
    const parsed = parsePlanFields(
      { show_on_landing: 0, is_featured: 1, name_bn: "নতুন নাম", accent_color: "#abc" },
      PLAN_SEEDS[1],
    );
    expect(parsed).toMatchObject({
      showOnLanding: 0,
      isFeatured: 1,
      nameBn: "নতুন নাম",
      accentColor: "#abc",
      price: 5000,
      renewalPrice: 2000,
      extraStudentPriceFirst: 50,
    });
  });
  it("clears other featured plans under the same transaction lock before saving", async () => {
    const rows = [
      { ...PLAN_SEEDS[1], id: 1, isFeatured: 1 },
      { ...PLAN_SEEDS[3], id: 2, isFeatured: 0 },
    ];
    const tx = {
      $executeRaw: vi.fn(),
      plan: {
        findMany: vi.fn(async () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)),
        update: vi.fn(async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id)!, data)),
        findFirst: vi.fn(async ({ where }) => rows.find((r) => r.id === where.id)),
        updateMany: vi.fn(async ({ where, data }) => {
          for (const row of rows) {
            if (typeof where.id === "number" && row.id !== where.id) continue;
            if (where.id?.not === row.id) continue;
            if (where.isFeatured !== undefined && row.isFeatured !== where.isFeatured) continue;
            Object.assign(row, data);
          }
          return { count: 1 };
        }),
      },
    };
    transaction.mockImplementation(async (fn) => fn(tx));
    await new PlansRepository().updateActiveById(2, { isFeatured: 1 });
    expect(rows.filter((r) => r.isFeatured === 1).map((r) => r.id)).toEqual([2]);
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.plan.updateMany.mock.invocationCallOrder[0],
    );
  });
  it("warns on non-increasing limits without blocking a display edit and logs the edit", async () => {
    const current = { ...PLAN_SEEDS[1], id: 2 };
    const repo = {
      findActiveById: vi.fn(async () => current),
      findActiveByNameExcludingId: vi.fn(async () => null),
      updateActiveById: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => [
        { ...current, sortOrder: 1 },
        { ...PLAN_SEEDS[0], id: 3, sortOrder: 2 },
      ]),
    };
    const service = new PlansService(repo as any);
    await expect(service.updatePlan(2, { showOnLanding: 0 }, 123)).resolves.toBeUndefined();
    expect(repo.updateActiveById).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ showOnLanding: 0, price: 5000 }),
    );
    expect(await service.planWarnings()).toHaveLength(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 123, entity: "plans", entity_id: 2 }),
    );
  });
});
