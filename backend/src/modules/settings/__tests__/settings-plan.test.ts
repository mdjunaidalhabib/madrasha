import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "http";
const { db } = vi.hoisted(() => ({
  db: {
    madrasa: { findUnique: vi.fn() },
    madrasaSubscription: { findFirst: vi.fn() },
    madrasaDomainSubscription: { findFirst: vi.fn() },
    subscriptionPayment: { findMany: vi.fn() },
    plan: { findMany: vi.fn() },
    student: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: db }));
vi.mock("../../super-admin/vendor-promo.service", () => ({ vendorPromoService: { getConfig: vi.fn(async () => ({ phone_display: "123", phone_intl: "880123", email: "support@example.test" })) } }));
vi.mock("../../../shared/storage", () => ({ storageProvider: {} }));
vi.mock("../../../shared/utils/jwt.util", () => ({
  verifyToken: (token: string) => {
    if (token === "guardian") return { type: "guardian", madrasa_id: 7 };
    if (token !== "7" && token !== "8") throw new Error("invalid token");
    return { id: 1, madrasa_id: Number(token), role_id: 1 };
  },
}));
vi.mock("../../../shared/auth/sessionStatus", () => ({ isSessionActive: vi.fn(async () => true) }));
import settingsRoutes from "../settings.routes";
import { PLAN_SEEDS } from "../../../../prisma/data/plans.seed";
import { invalidateSubscriptionCache } from "../../../shared/subscription/subscription-state";

let server: Server;
let base: string;
const now = new Date("2026-11-07T00:00:00Z");
beforeAll(async () => {
  const app = express();
  app.use("/settings", settingsRoutes);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as any).port}/settings`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  invalidateSubscriptionCache();
  const plus = PLAN_SEEDS.find((p) => p.name === "Plus")!;
  db.madrasa.findUnique.mockImplementation(async ({ where }) => ({
    id: where.id ?? Number(where.slug),
    slug: String(where.id ?? where.slug),
    isActive: 1,
    deletedAt: null,
    studentLimit: 300,
    userLimit: 5,
    planStatus: "active",
  }));
  db.madrasaSubscription.findFirst.mockImplementation(async ({ where, orderBy }) =>
    orderBy?.id === "asc"
      ? { id: where.madrasaId }
      : {
          id: where.madrasaId,
          isActive: 1,
          cycle: "FIRST",
          plan: plus,
          pricePaid: 10000,
          startDate: now,
          endDate: new Date(+now + 364 * 86400000),
          cancelledAt: null,
          refundedAt: null,
        },
  );
  db.plan.findMany.mockResolvedValue(PLAN_SEEDS);
  db.student.count.mockImplementation(async ({ where }) => (where.madrasaId === 7 ? 450 : 10));
  db.user.count.mockResolvedValue(5);
  db.madrasaDomainSubscription.findFirst.mockImplementation(async ({ where }) => ({
    domain: `school${where.madrasaId}.com`,
    endDate: new Date(+now + 86400000),
    isActive: 1,
  }));
  db.subscriptionPayment.findMany.mockImplementation(async ({ where }) => [
    {
      amount: where.madrasaId * 100,
      paymentMethod: "manual",
      status: "paid",
      createdAt: now,
      transactionId: "private",
    },
  ]);
});
afterEach(() => vi.useRealTimers());
const request = (tenant: number, token = String(tenant), path = "/plan") =>
  fetch(base + path, {
    headers: { "x-madrasa-slug": String(tenant), Authorization: `Bearer ${token}` },
  });

describe("GET /settings/plan", () => {
  it("retains old fields, adds pricing/refund/domain data and isolates two tenants", async () => {
    const response = await request(7);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as any;
    expect(data).toMatchObject({
      plan_name: "Plus",
      plan_name_bn: "প্লাস",
      price: 10000,
      duration_days: 365,
      days_remaining: 364,
      plan_status: "active",
      has_active_subscription: true,
      student_limit: 300,
      user_limit: 5,
      usage: { students: 450, users: 5 },
      cycle: "FIRST",
      renewal_price: 4000,
      price_paid: 10000,
      next_renewal_price: 5500,
      days_since_expiry: null,
      retention_warning_days: 60,
      subscription_id: 7,
      renewal_contact: { phone_intl: "880123", email: "support@example.test" },
      refund: { eligible: true, amount: 10000 },
      custom_domain: { domain: "school7.com", is_active: true },
      over_limit: {
        extra_students: 150,
        extra_charge: 5250,
        upgrade_to: { plan_name: "Pro", charge: 4000 },
        recommended: "UPGRADE",
      },
      payments: [{ amount: 700, method: "manual", status: "paid" }],
    });
    expect(data.start_date).toBe(now.toISOString());
    expect(data.payments[0]).not.toHaveProperty("transactionId");
    expect(db.subscriptionPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { madrasaId: 7 }, take: 10 }),
    );
    expect(db.student.count).toHaveBeenCalledWith({
      where: { madrasaId: 7, isActive: 1, deletedAt: null },
    });
    const second = (await (await request(8)).json()) as any;
    expect(second.data.usage.students).toBe(10);
    expect(second.data.over_limit).toBeNull();
    expect(second.data.custom_domain.domain).toBe("school8.com");
    expect(second.data.payments[0].amount).toBe(800);
  });
  it("rejects another tenant's token, guardian tokens and missing authorization", async () => {
    expect((await request(8, "7")).status).toBe(401);
    expect((await request(7, "guardian")).status).toBe(401);
    expect((await fetch(base + "/plan", { headers: { "x-madrasa-slug": "7" } })).status).toBe(401);
  });

  it("quotes the same refund amount as cancellation for a legacy subscription without pricePaid", async () => {
    const current = await db.madrasaSubscription.findFirst({ where: { madrasaId: 7 }, orderBy: { id: "desc" } });
    db.madrasaSubscription.findFirst.mockImplementation(async ({ where, orderBy }) => orderBy?.id === "asc" ? { id: where.madrasaId } : {
      ...current, pricePaid: null, payments: [{ amount: 3000 }, { amount: 2000 }],
    });
    const { data } = await (await request(7)).json() as any;
    expect(data.refund).toMatchObject({ eligible: true, amount: 5000 });
    expect(data.payments[0].amount).toBe(700);
  });
  it("lets an expired tenant see only the authenticated plan route, with the retention notice", async () => {
    db.madrasaSubscription.findFirst.mockImplementation(async ({ where, orderBy }) =>
      orderBy?.id === "asc"
        ? { id: where.madrasaId }
        : {
            id: where.madrasaId,
            isActive: 1,
            cycle: "RENEWAL",
            plan: PLAN_SEEDS[3],
            pricePaid: 4000,
            startDate: new Date(+now - 370 * 86400000),
            endDate: new Date(+now - 5 * 86400000),
          },
    );
    const { data } = (await (await request(7)).json()) as any;
    expect(data).toMatchObject({
      days_since_expiry: 5,
      plan_status: "suspended",
      has_active_subscription: false,
      refund: { eligible: false },
    });
    expect(data.retention_notice).toContain("৬০ দিন");
    expect((await request(7, "7", "/branding")).status).toBe(423);
  });

  it("allows a manually suspended tenant to see plan details after authentication", async () => {
    db.madrasa.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id ?? Number(where.slug),
      slug: String(where.slug),
      isActive: 0,
      deletedAt: null,
      studentLimit: 300,
      planStatus: "suspended",
    }));
    const result = await request(7);
    expect(result.status).toBe(200);
    expect(((await result.json()) as any).data.plan_status).toBe("suspended");
    expect((await request(7, "7", "/branding")).status).toBe(423);
  });
});
