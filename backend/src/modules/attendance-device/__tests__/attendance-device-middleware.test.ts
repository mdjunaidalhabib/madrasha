import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/config/env", () => ({
  env: { attendanceTimezone: "Asia/Dhaka", deviceSecretEncKey: "ab".repeat(32), smsMaxAttempts: 5 },
}));
vi.mock("../../../shared/logger/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../../shared/database/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { logger } from "../../../shared/logger/logger";
import { attendanceDeviceConnectorAuth } from "../attendance-device.middleware";
import { hashDeviceKey } from "../device-secret.util";
import { db, resetDb } from "./fake-prisma";

const RAW_A = "adk_raw_key_of_madrasa_a";

const seedDevice = (over: Record<string, unknown> = {}) =>
  db.attendanceDevice.push({
    id: 1,
    madrasaId: 10,
    deviceCode: "k40-a",
    name: "Gate",
    apiKeyHash: hashDeviceKey(RAW_A),
    isActive: true,
    ...over,
  });

const run = async (opts: { key?: string; tenant?: number; body?: any; query?: any }) => {
  const req: any = {
    headers: opts.key ? { "x-device-key": opts.key } : {},
    tenant: { madrasa_id: opts.tenant ?? 10, slug: "a" },
    body: opts.body ?? {},
    query: opts.query ?? {},
    ip: "1.2.3.4",
    path: "/ingest",
  };
  const res: any = {
    statusCode: 0,
    payload: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(p: unknown) {
      this.payload = p;
      return this;
    },
  };
  const next = vi.fn();
  await attendanceDeviceConnectorAuth(req, res, next);
  return { req, res, next };
};

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

describe("connector auth: tenant isolation", () => {
  it("accepts the right key inside its own madrasa and attaches the device", async () => {
    seedDevice();
    const { req, next, res } = await run({ key: RAW_A, body: { device_id: "k40-a" } });
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
    expect(req.attendanceDevice.id).toBe(1);
  });

  it("a device key of madrasa A cannot authenticate against madrasa B", async () => {
    seedDevice();
    const { next, res } = await run({ key: RAW_A, tenant: 20 });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects when body device_id differs from the authenticated device", async () => {
    seedDevice();
    const { next, res } = await run({ key: RAW_A, body: { device_id: "some-other-device" } });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("rejects an institution_id that is not the tenant madrasa, accepts the matching one", async () => {
    seedDevice();
    const bad = await run({ key: RAW_A, body: { device_id: "k40-a", institution_id: 99 } });
    expect(bad.res.statusCode).toBe(403);
    const ok = await run({ key: RAW_A, body: { device_id: "k40-a", institution_id: "10" } });
    expect(ok.next).toHaveBeenCalled();
  });

  it("requires the key header, and rejects unknown or inactive devices", async () => {
    seedDevice();
    expect((await run({})).res.statusCode).toBe(401);
    expect((await run({ key: "wrong" })).res.statusCode).toBe(401);
    db.attendanceDevice[0].isActive = false;
    expect((await run({ key: RAW_A })).res.statusCode).toBe(403);
  });

  it("logs auth failures without the key", async () => {
    seedDevice();
    await run({ key: "super-secret-wrong-key" });
    const logged = JSON.stringify((logger.warn as any).mock.calls);
    expect(logged).toContain("unknown_key");
    expect(logged).not.toContain("super-secret-wrong-key");
  });
});
