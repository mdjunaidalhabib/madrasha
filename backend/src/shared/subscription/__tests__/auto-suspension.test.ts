import { beforeEach, describe, expect, it, vi } from "vitest";

const madrasaFindUnique = vi.fn();
const subscriptionFindFirst = vi.fn();
vi.mock("../../database/prisma", () => ({
  prisma: {
    madrasa: { findUnique: madrasaFindUnique, findFirst: vi.fn(async () => null) },
    madrasaSubscription: { findFirst: subscriptionFindFirst },
  },
}));
vi.mock("../../config/env", () => ({ env: { subscriptionEnforcement: true } }));
vi.mock("../../logger/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { env } from "../../config/env";
import { tenantMiddleware } from "../../middleware/tenant.middleware";
import { getSubscriptionState, invalidateSubscriptionCache } from "../subscription-state";

const DAY = 24 * 60 * 60 * 1000;
const dateOnly = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const runTenant = async () => {
  const out: { status?: number; body?: any; nexted: boolean; tenant?: any } = { nexted: false };
  const res: any = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: any) {
      out.body = body;
      return this;
    },
  };
  const req: any = { headers: { "x-madrasa-slug": "demo" }, params: {}, query: {} };
  await tenantMiddleware(req, res, () => {
    out.nexted = true;
    out.tenant = req.tenant;
  });
  return out;
};

beforeEach(() => {
  madrasaFindUnique.mockReset();
  subscriptionFindFirst.mockReset();
  invalidateSubscriptionCache();
  (env as any).subscriptionEnforcement = true;
  madrasaFindUnique.mockResolvedValue({ id: 7, slug: "demo", name: "Demo", isActive: 1, deletedAt: null, websiteStatus: "published" });
});

describe("getSubscriptionState", () => {
  it("is NONE when there is no active subscription", async () => {
    subscriptionFindFirst.mockResolvedValue(null);
    expect(await getSubscriptionState(7)).toBe("NONE");
  });

  it("is ACTIVE when the end date is in the future or unset", async () => {
    subscriptionFindFirst.mockResolvedValue({ endDate: dateOnly(10) });
    expect(await getSubscriptionState(7)).toBe("ACTIVE");
    invalidateSubscriptionCache(7);
    subscriptionFindFirst.mockResolvedValue({ endDate: null });
    expect(await getSubscriptionState(7)).toBe("ACTIVE");
  });

  it("stays ACTIVE through the whole last day, EXPIRED the day after", async () => {
    subscriptionFindFirst.mockResolvedValue({ endDate: dateOnly(0) });
    expect(await getSubscriptionState(7)).toBe("ACTIVE");
    invalidateSubscriptionCache(7);
    subscriptionFindFirst.mockResolvedValue({ endDate: dateOnly(-1) });
    expect(await getSubscriptionState(7)).toBe("EXPIRED");
  });

  it("caches the lookup until invalidated (renewal takes effect immediately)", async () => {
    subscriptionFindFirst.mockResolvedValue({ endDate: dateOnly(-3) });
    expect(await getSubscriptionState(7)).toBe("EXPIRED");
    expect(await getSubscriptionState(7)).toBe("EXPIRED");
    expect(subscriptionFindFirst).toHaveBeenCalledTimes(1);

    subscriptionFindFirst.mockResolvedValue({ endDate: dateOnly(30) });
    invalidateSubscriptionCache(7);
    expect(await getSubscriptionState(7)).toBe("ACTIVE");
  });
});

describe("tenantMiddleware auto-suspension", () => {
  it("suspends (423) a madrasa whose subscription expired - this covers login too", async () => {
    subscriptionFindFirst.mockResolvedValue({ endDate: dateOnly(-5) });
    const r = await runTenant();
    expect(r.status).toBe(423);
    expect(r.body.code).toBe("SUBSCRIPTION_EXPIRED");
    expect(r.nexted).toBe(false);
  });

  it("suspends a madrasa that has no subscription", async () => {
    subscriptionFindFirst.mockResolvedValue(null);
    const r = await runTenant();
    expect(r.status).toBe(423);
    expect(r.body.code).toBe("SUBSCRIPTION_NONE");
  });

  it("lets a madrasa with an active subscription through", async () => {
    subscriptionFindFirst.mockResolvedValue({ endDate: dateOnly(30) });
    const r = await runTenant();
    expect(r.nexted).toBe(true);
    expect(r.tenant).toEqual({ madrasa_id: 7, slug: "demo" });
  });

  it("a manually suspended madrasa is still rejected without a subscription lookup", async () => {
    madrasaFindUnique.mockResolvedValue({ id: 7, slug: "demo", name: "Demo", isActive: 0, deletedAt: null, websiteStatus: "published" });
    const r = await runTenant();
    expect(r.status).toBe(423);
    expect(subscriptionFindFirst).not.toHaveBeenCalled();
  });

  it("does nothing extra when enforcement is switched off", async () => {
    (env as any).subscriptionEnforcement = false;
    subscriptionFindFirst.mockResolvedValue(null);
    const r = await runTenant();
    expect(r.nexted).toBe(true);
    expect(subscriptionFindFirst).not.toHaveBeenCalled();
  });
});
