import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { count, invalidate } = vi.hoisted(() => ({ count: vi.fn(), invalidate: vi.fn() }));
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../settings/settings.repository", () => ({
  settingsRepository: { countActiveStudents: count },
}));
vi.mock("../../../shared/subscription/subscription-state", () => ({
  invalidateSubscriptionCache: invalidate,
}));
import { SubscriptionsService } from "../subscriptions.service";
import { PLAN_SEEDS } from "../../../../prisma/data/plans.seed";

const plans = PLAN_SEEDS.map((p, index) => ({ ...p, id: index + 1 }));
const basic = plans.find((p) => p.name === "Basic")!;
const now = new Date("2026-11-07T00:00:00Z");
const day = 86400000;
const setup = () => {
  const tx = {};
  const repo = {
    transaction: vi.fn(async (fn) => fn(tx)),
    lock: vi.fn(async () => ({ id: 7 })),
    latest: vi.fn(async (): Promise<any> => null),
    plans: vi.fn(async () => plans),
    deactivate: vi.fn(),
    create: vi.fn(async (_tx, data) => ({ id: 30, ...data })),
    payment: vi.fn(),
    activate: vi.fn(),
    log: vi.fn(),
    refundRecord: vi.fn(
      async (): Promise<any> => ({
        id: 30,
        madrasaId: 7,
        isActive: 1,
        cycle: "FIRST",
        startDate: new Date(+now - 30 * day),
        pricePaid: 5000,
        payments: [],
      }),
    ),
    firstPurchase: vi.fn(async () => ({ id: 30 })),
    cancel: vi.fn(),
    suspend: vi.fn(),
    expiredCandidates: vi.fn(),
  };
  return { service: new SubscriptionsService(repo as any), repo, tx };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  count.mockReset().mockResolvedValue(80);
  invalidate.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("subscription purchase and renewal", () => {
  it("records first-cycle price, limit snapshot and a paid payment in one transaction", async () => {
    const { service, repo, tx } = setup();
    const result = await service.purchase(7, { plan_id: basic.id, transaction_id: "receipt-1" });
    expect(result).toMatchObject({
      cycle: "FIRST",
      pricePaid: 6000,
      studentLimitAtStart: 100,
      startDate: now,
      endDate: new Date(+now + 364 * day),
    });
    expect(repo.payment).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        madrasaId: 7,
        subscriptionId: 30,
        amount: 6000,
        status: "paid",
        transactionId: "receipt-1",
      }),
    );
    expect(count).toHaveBeenCalledWith(7, tx);
    expect(repo.activate).toHaveBeenCalledWith(tx, 7, 100);
    expect(invalidate).toHaveBeenCalledWith(7);
  });
  it.each([0, 15, 16, 60, 61])(
    "renews %i days after expiry using the fitting plan and correct anchor",
    async (days) => {
      const { service, repo } = setup();
      count.mockResolvedValue(450);
      const endDate = new Date(+now - days * day);
      repo.latest.mockResolvedValue({ id: 5, endDate });
      const result = await service.purchase(7, { plan_id: basic.id });
      expect(result).toMatchObject({ cycle: "RENEWAL", pricePaid: 5500, studentLimitAtStart: 500 });
      expect(result.startDate).toEqual(days <= 60 ? new Date(+endDate + day) : now);
      expect(result.endDate).toEqual(
        new Date(+(days <= 60 ? endDate : now) + (days <= 60 ? 365 : 364) * day),
      );
    },
  );
  it("does not charge, suspend or invalidate before a failed transaction commits", async () => {
    const { service, repo } = setup();
    repo.payment.mockRejectedValue(new Error("payment failed"));
    await expect(service.purchase(7, { plan_id: basic.id })).rejects.toThrow("payment failed");
    expect(invalidate).not.toHaveBeenCalled();
  });
  it("requires a negotiated amount for Custom renewals", async () => {
    const { service, repo } = setup();
    count.mockResolvedValue(2100);
    repo.latest.mockResolvedValue({ id: 5, endDate: now });
    const custom = { ...basic, id: 100, studentLimit: 3000 };
    repo.plans.mockResolvedValue([...plans, custom]);
    await expect(service.purchase(7, { plan_id: 100 })).rejects.toThrow();
    expect((await service.purchase(7, { plan_id: 100, custom_amount: 20000 })).pricePaid).toBe(
      20000,
    );
  });
});

describe("manual refunds", () => {
  it("refunds 100% on day 30, records timestamps, suspends and invalidates", async () => {
    const { service, repo, tx } = setup();
    expect(await service.cancelAndRefund(7, 30)).toMatchObject({ refundAmount: 5000 });
    expect(repo.refundRecord).toHaveBeenCalledWith(tx, 7, 30);
    expect(repo.cancel).toHaveBeenCalledWith(tx, 30, 5000, now);
    expect(repo.suspend).toHaveBeenCalledWith(tx, 7);
    expect(repo.log).toHaveBeenCalledWith(
      tx,
      7,
      "SUPER_ADMIN_SUBSCRIPTION_REFUNDED",
      30,
      expect.any(String),
    );
    expect(invalidate).toHaveBeenCalledWith(7);
  });
  it.each([
    { startDate: new Date(+now - 31 * day) },
    { cycle: "RENEWAL" },
    { cancelledAt: now },
    { isActive: 0 },
  ])("rejects expired, renewal or duplicate refunds: %o", async (override) => {
    const { service, repo } = setup();
    const original = await repo.refundRecord();
    repo.refundRecord.mockResolvedValue({ ...original, ...override });
    await expect(service.cancelAndRefund(7, 30)).rejects.toThrow();
    expect(repo.cancel).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
  it("cannot refund a later purchase even if legacy data labels it FIRST", async () => {
    const { service, repo } = setup();
    repo.firstPurchase.mockResolvedValue({ id: 1 });
    await expect(service.cancelAndRefund(7, 30)).rejects.toThrow();
  });
});

describe("manual deletion work list", () => {
  it("includes only latest expiries strictly beyond 60 days and reuses active-student counts", async () => {
    const { service, repo } = setup();
    repo.expiredCandidates.mockResolvedValue([
      { id: 7, name: "Old", subscriptions: [{ endDate: new Date(+now - 61 * day) }] },
      { id: 8, name: "Grace", subscriptions: [{ endDate: new Date(+now - 60 * day) }] },
      { id: 9, name: "Renewed", subscriptions: [{ endDate: new Date(+now + day) }] },
    ]);
    expect(await service.listExpired()).toEqual([
      {
        id: 7,
        name: "Old",
        endDate: new Date(+now - 61 * day),
        daysSinceExpiry: 61,
        studentCount: 80,
      },
    ]);
    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith(7);
  });
});
