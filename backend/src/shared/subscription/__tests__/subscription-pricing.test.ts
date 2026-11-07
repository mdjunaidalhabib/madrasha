import { describe, expect, it, vi } from "vitest";
import { PLAN_SEEDS, seedPlans } from "../../../../prisma/data/plans.seed";
import {
  daysRemainingInTerm,
  extraStudentCharge,
  extraStudentRate,
  isRefundEligible,
  pickPlanForStudents,
  priceForCycle,
  recommendOverLimitAction,
  renewalTerms,
  upgradeCharge,
} from "../subscription-pricing";

const plan = (name: string) => PLAN_SEEDS.find((p) => p.name === name)!;
const term = { cycle: "FIRST" as const, remainingDays: 365, durationDays: 365 };

describe("subscription pricing", () => {
  it("keeps the last valid UTC day consistent across expiry and plan responses", () => {
    const end = new Date("2026-11-07T00:00:00Z");
    expect(daysRemainingInTerm(end, new Date("2026-11-07T23:59:59Z"))).toBe(0);
    expect(daysRemainingInTerm(end, new Date("2026-11-08T00:00:00Z"))).toBe(-1);
    expect(daysRemainingInTerm(null)).toBeNull();
  });
  it.each([
    [50, "Starter"],
    [51, "Basic"],
    [100, "Basic"],
    [101, "Standard"],
    [2000, "Max"],
    [2001, "CUSTOM"],
  ])("selects the smallest plan for %i students", (count, expected) => {
    const selected = pickPlanForStudents([...PLAN_SEEDS].reverse(), count as number);
    expect(selected === "CUSTOM" ? selected : selected.name).toBe(expected);
  });
  it("uses the cycle's price and preserves legacy prices when renewal price is missing", () => {
    expect(priceForCycle(plan("Basic"), "FIRST")).toBe(5000);
    expect(priceForCycle(plan("Basic"), "RENEWAL")).toBe(2000);
    expect(priceForCycle({ price: "2400", studentLimit: 100 }, "RENEWAL")).toBe(2400);
  });
  it.each([
    ["Basic", 120, 1000],
    ["Plus", 380, 2800],
  ])("charges %s extras", (name, count, amount) => {
    expect(
      extraStudentCharge({ ...term, plan: plan(name as string), studentCount: count as number }),
    ).toBe(amount);
  });
  it("recommends the fitting upgrade with both amounts", () => {
    expect(
      recommendOverLimitAction({
        ...term,
        plan: plan("Plus"),
        plans: PLAN_SEEDS,
        studentCount: 450,
      }),
    ).toMatchObject({
      recommendedAction: "UPGRADE",
      extraAmount: 5250,
      upgradeAmount: 4000,
      blocked: false,
      upgradePlan: { name: "Pro" },
    });
  });
  it("recommends extras when cheaper and allows Custom counts", () => {
    expect(
      recommendOverLimitAction({
        ...term,
        plan: plan("Basic"),
        plans: PLAN_SEEDS,
        studentCount: 101,
      }),
    ).toMatchObject({
      recommendedAction: "EXTRA_STUDENTS",
      extraAmount: 50,
      upgradeAmount: 3000,
      blocked: false,
    });
    expect(
      recommendOverLimitAction({
        ...term,
        plan: plan("Max"),
        plans: PLAN_SEEDS,
        studentCount: 2500,
      }),
    ).toMatchObject({ overLimit: true, blocked: false, upgradeAmount: null, extraAmount: 12500 });
    expect(extraStudentRate({ studentLimit: 2500, price: 0 }, "FIRST")).toBe(20);
    expect(extraStudentRate({ studentLimit: 2500, price: 0 }, "RENEWAL")).toBe(8);
  });
  it("prorates extras and upgrades in the current cycle, rounding charges up", () => {
    expect(
      extraStudentCharge({
        ...term,
        plan: plan("Basic"),
        cycle: "RENEWAL",
        studentCount: 101,
        remainingDays: 1,
      }),
    ).toBe(1);
    expect(
      upgradeCharge({
        ...term,
        fromPlan: plan("Plus"),
        toPlan: plan("Pro"),
        cycle: "RENEWAL",
        remainingDays: 100,
      }),
    ).toBe(411);
    expect(
      extraStudentCharge({ ...term, plan: plan("Plus"), studentCount: 380, remainingDays: 100 }),
    ).toBe(768);
  });
  it("never refunds unused capacity, negative remaining days or a cheaper upgrade", () => {
    expect(extraStudentCharge({ ...term, plan: plan("Basic"), studentCount: 50 })).toBe(0);
    expect(
      extraStudentCharge({ ...term, plan: plan("Basic"), studentCount: 120, remainingDays: -1 }),
    ).toBe(0);
    expect(upgradeCharge({ ...term, fromPlan: plan("Pro"), toPlan: plan("Plus") })).toBe(0);
    expect(
      recommendOverLimitAction({
        ...term,
        plan: plan("Basic"),
        plans: PLAN_SEEDS,
        studentCount: 100,
      }),
    ).toMatchObject({ recommendedAction: "NONE", overLimit: false, blocked: false });
  });
  it("respects an explicitly configured zero extra rate", () => {
    expect(
      extraStudentCharge({
        ...term,
        plan: { ...plan("Basic"), extraStudentPriceFirst: 0 },
        studentCount: 120,
      }),
    ).toBe(0);
  });
  it("does not overcharge an admin-edited decimal extra-student rate", () => {
    expect(extraStudentCharge({ ...term, plan: { ...plan("Basic"), extraStudentPriceFirst: 1.1 }, studentCount: 200 })).toBe(110);
  });
  it("handles an empty catalogue and an invalid or exceeded term without overcharging", () => {
    expect(pickPlanForStudents([], 50)).toBe("CUSTOM");
    expect(
      extraStudentCharge({ ...term, plan: plan("Basic"), studentCount: 120, durationDays: 0 }),
    ).toBe(0);
    expect(
      extraStudentCharge({ ...term, plan: plan("Basic"), studentCount: 120, remainingDays: 500 }),
    ).toBe(1000);
  });
  it.each([
    [0, "FIRST", true],
    [30, "FIRST", true],
    [31, "FIRST", false],
    [-1, "FIRST", false],
    [1, "RENEWAL", false],
  ] as const)("refund day %i, cycle %s", (day, cycle, eligible) => {
    const startDate = new Date("2026-01-01T00:00:00Z");
    expect(isRefundEligible({ startDate, now: new Date(+startDate + day * 86400000), cycle })).toBe(
      eligible,
    );
  });
  it.each([-7, 0, 15, 16, 60, 61])("anchors renewal %i days after expiry", (day) => {
    const endDate = new Date("2026-01-01T00:00:00Z");
    const now = new Date(+endDate + day * 86400000);
    expect(renewalTerms({ endDate, now })).toEqual({
      extendsFrom: day <= 60 ? endDate : now,
      lateFee: 0,
    });
  });
});

describe("plan seed", () => {
  it("creates the nine complete plans in an empty store", async () => {
    const created: unknown[] = [];
    await seedPlans({
      upsert: async ({ create }) => {
        created.push(create);
        return { id: created.length };
      },
    });
    expect(created).toEqual(PLAN_SEEDS);
    expect(created).toHaveLength(9);
  });
  it("creates all nine and preserves IDs, legacy subscriptions, custom plans and admin edits on re-seed", async () => {
    const stored = new Map<string, any>([
      ["Custom", { id: 90, name: "Custom" }],
      ["Basic", { id: 91, name: "Basic", price: 4321 }],
    ]);
    const upsert = vi.fn(async ({ where, create, update }) => {
      expect(update).toEqual({});
      if (!stored.has(where.name)) stored.set(where.name, { ...create, id: stored.size + 100 });
      else Object.assign(stored.get(where.name), update);
      return stored.get(where.name);
    });
    const first = await seedPlans({ upsert });
    stored.get("Plus").price = 12345;
    expect(await seedPlans({ upsert })).toEqual(first);
    expect(stored.size).toBe(10);
    expect(stored.get("Basic")).toMatchObject({ id: 91, price: 4321 });
    expect(stored.get("Plus").price).toBe(12345);
    expect(PLAN_SEEDS.filter((p) => p.isFeatured)).toEqual([plan("Plus")]);
    expect(PLAN_SEEDS.every((p) => p.userLimit === null && p.durationDays === 365)).toBe(true);
  });
});
