import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), loader: vi.fn(), findLoader: vi.fn() }));
vi.mock("../../database/prisma", () => ({ prisma: { activityLog: { create: mocks.create } } }));
vi.mock("../activityDetails", () => ({
  findSnapshotLoader: mocks.findLoader,
  buildSnapshotDetails: (before: { title: string } | null, after: { title: string } | null) =>
    after?.title ?? before?.title ?? null,
}));
vi.mock("../activityBulkDetails", () => ({ findBulkDescriber: () => null }));
vi.mock("../../logger/logger", () => ({ logger: { error: vi.fn() } }));

import { activityLoggerMiddleware } from "../../middleware/activityLogger.middleware";
import { logActivity } from "../activity.util";

function request(
  path: string,
  options: {
    status?: number;
    tenant?: number;
    actor?: number;
    method?: string;
    body?: unknown;
  } = {},
  service?: () => Promise<void>,
) {
  const req = {
    method: options.method ?? "POST",
    originalUrl: `/api/${path}`,
    body: options.body ?? {},
  } as Request;
  const res = Object.assign(new EventEmitter(), {
    locals: {},
    statusCode: options.status ?? 201,
    json: vi.fn(),
  }) as unknown as Response;
  return new Promise<void>((resolve, reject) => {
    activityLoggerMiddleware(req, res, () => {
      (async () => {
        req.tenant = { madrasa_id: options.tenant ?? 1 } as Request["tenant"];
        if (options.actor !== 0) req.user = { id: options.actor ?? 10 } as Request["user"];
        await service?.();
        res.json({ data: { id: 45 } });
        res.emit("finish");
        // Let the asynchronous finish handler and database write settle.
        await new Promise((done) => setImmediate(done));
        resolve();
      })().catch(reject);
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findLoader.mockReturnValue(null);
  mocks.create.mockResolvedValue({ id: 1 });
});

describe("automatic activity logging", () => {
  it("covers new routes in modules that also contain service-logged actions", async () => {
    await request("users/new-operation", { body: { name: "Example" } });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      madrasaId: 1,
      userId: 10,
      entity: "users/new-operation",
      entityId: 45,
    });
  });

  it("keeps the detailed service log without adding a duplicate fallback", async () => {
    await request("users", {}, async () => {
      await logActivity({
        madrasa_id: 1,
        user_id: 10,
        entity: "USER",
        action: "CREATE",
        details: "Detailed event",
      });
    });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][0].data.details).toBe("Detailed event");
  });

  it("isolates concurrent requests and tenant logs", async () => {
    await Promise.all([
      request("users", {}, () =>
        logActivity({ madrasa_id: 1, user_id: 10, entity: "USER", action: "CREATE" }),
      ),
      request("staff", { tenant: 2, actor: 20 }),
    ]);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(
      mocks.create.mock.calls.some(
        ([entry]) => entry.data.madrasaId === 2 && entry.data.entity === "staff",
      ),
    ).toBe(true);
  });

  it("preserves the primary action when a service only logs a secondary effect", async () => {
    await request("trash/students/8/restore", {}, () =>
      logActivity({
        madrasa_id: 1,
        user_id: 10,
        entity: "results/reopen",
        action: "REOPEN",
        entity_id: 2,
      }),
    );
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(
      mocks.create.mock.calls.some(([entry]) => entry.data.entity === "trash/students/restore"),
    ).toBe(true);
  });

  it("recognizes account aliases and auth profile service logs", async () => {
    await request("accounts/funds", {}, () =>
      logActivity({
        madrasa_id: 1,
        user_id: 10,
        entity: "FUND_SETTINGS",
        action: "CREATE",
      }),
    );
    await request("auth/me", { method: "PATCH" }, () =>
      logActivity({
        madrasa_id: 1,
        user_id: 10,
        entity: "USER",
        action: "UPDATE",
      }),
    );
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("does not log failed responses, anonymous requests or background refresh", async () => {
    await request("staff", { status: 403 });
    await request("staff", { actor: 0 });
    await request("auth/refresh");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("loads newly created records using the response id", async () => {
    mocks.findLoader.mockReturnValue(mocks.loader);
    mocks.loader.mockResolvedValue({ madrasaId: 1, title: "স্টাফ: নতুন নাম", fields: {} });
    await request("staff");
    expect(mocks.loader).toHaveBeenCalledWith(45);
    expect(mocks.create.mock.calls[0][0].data.details).toBe("স্টাফ: নতুন নাম");
  });

  it("discards snapshots belonging to another institution", async () => {
    mocks.findLoader.mockReturnValue(mocks.loader);
    mocks.loader.mockResolvedValue({ madrasaId: 99, title: "Private other tenant", fields: {} });
    await request("staff/8", { method: "DELETE" });
    const event = mocks.create.mock.calls[0][0].data;
    expect(event.details).not.toContain("Private other tenant");
    expect(event.details).toContain("রেকর্ড আইডি: 8");
  });
});
