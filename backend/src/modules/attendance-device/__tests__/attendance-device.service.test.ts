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

import { AttendanceDeviceService, computeDeviceStatus, toDeviceDto } from "../attendance-device.service";
import { decryptDeviceSecret, hashDeviceKey } from "../device-secret.util";
import { AttendanceDeviceIngestService } from "../attendance-device-ingest.service";
import { db, resetDb } from "./fake-prisma";

const NOW = new Date("2026-09-20T05:00:00.000Z");
const ingest = new AttendanceDeviceIngestService(undefined, () => NOW);
const service = new AttendanceDeviceService(undefined, ingest, () => NOW);

beforeEach(() => resetDb());

describe("computeDeviceStatus", () => {
  const base = { pollIntervalSec: 30, status: "online" };
  it("unknown when the connector was never seen", () => {
    expect(computeDeviceStatus({ ...base, lastSeenAt: null }, NOW)).toBe("unknown");
  });
  it("uses the reported status while the connector is fresh", () => {
    expect(computeDeviceStatus({ ...base, lastSeenAt: new Date(NOW.getTime() - 80_000) }, NOW)).toBe("online");
    expect(computeDeviceStatus({ status: "offline", pollIntervalSec: 30, lastSeenAt: new Date(NOW.getTime() - 10_000) }, NOW)).toBe("offline");
  });
  it("is OFFLINE when silent for more than 3 poll intervals, whatever it last reported", () => {
    expect(computeDeviceStatus({ ...base, lastSeenAt: new Date(NOW.getTime() - 91_000) }, NOW)).toBe("offline");
    expect(computeDeviceStatus({ ...base, pollIntervalSec: 60, lastSeenAt: new Date(NOW.getTime() - 91_000) }, NOW)).toBe("online");
  });
});

describe("device management", () => {
  it("create returns the raw key once, stores only its hash and an encrypted comm password", async () => {
    const created = await service.createDevice(10, {
      device_id: "k40-a",
      name: "Gate",
      ip: "192.168.1.201",
      comm_password: "654321",
    } as any);

    expect(created.raw_key).toMatch(/^adk_/);
    expect(JSON.stringify(created)).not.toContain("654321");
    expect(created).not.toHaveProperty("api_key_hash");
    expect(created).not.toHaveProperty("comm_password");
    expect(created.has_comm_password).toBe(true);
    expect(created.port).toBe(4370);
    expect(created.poll_interval_sec).toBe(30);

    const row = db.attendanceDevice[0];
    expect(row.apiKeyHash).toBe(hashDeviceKey(created.raw_key));
    expect(row.apiKeyHash).not.toBe(created.raw_key);
    expect(row.commPassword).not.toContain("654321");
    expect(decryptDeviceSecret(row.commPassword)).toBe("654321");
  });

  it("rotate-key issues a new key and invalidates the old hash", async () => {
    const created = await service.createDevice(10, { name: "Gate", ip: "10.0.0.5" } as any);
    const rotated = await service.rotateKey(10, created.id);
    expect(rotated.raw_key).not.toBe(created.raw_key);
    expect(db.attendanceDevice[0].apiKeyHash).toBe(hashDeviceKey(rotated.raw_key));
    expect(db.attendanceDevice[0].apiKeyHash).not.toBe(hashDeviceKey(created.raw_key));
  });

  it("duplicate device_id in the same madrasa -> 409, but another madrasa may reuse it", async () => {
    await service.createDevice(10, { device_id: "k40-a", name: "A", ip: "10.0.0.5" } as any);
    await expect(service.createDevice(10, { device_id: "k40-a", name: "B", ip: "10.0.0.6" } as any)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(service.createDevice(20, { device_id: "k40-a", name: "C", ip: "10.0.0.7" } as any)).resolves.toBeTruthy();
  });

  it("cross-tenant update/delete/rotate/test -> 404 and nothing changes", async () => {
    const created = await service.createDevice(10, { name: "Gate", ip: "10.0.0.5" } as any);
    const hashBefore = db.attendanceDevice[0].apiKeyHash;

    await expect(service.updateDevice(20, created.id, { name: "hacked" } as any)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.deleteDevice(20, created.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.rotateKey(20, created.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.requestTest(20, created.id)).rejects.toMatchObject({ statusCode: 404 });

    expect(db.attendanceDevice[0].name).toBe("Gate");
    expect(db.attendanceDevice[0].apiKeyHash).toBe(hashBefore);
    expect(db.attendanceDevice[0].testRequestedAt).toBeUndefined();
  });

  it("update: empty comm_password leaves it unchanged, null clears it, string replaces it", async () => {
    const created = await service.createDevice(10, { name: "Gate", ip: "10.0.0.5", comm_password: "111" } as any);
    const original = db.attendanceDevice[0].commPassword;

    await service.updateDevice(10, created.id, { comm_password: "" } as any);
    expect(db.attendanceDevice[0].commPassword).toBe(original);

    await service.updateDevice(10, created.id, { comm_password: "222" } as any);
    expect(decryptDeviceSecret(db.attendanceDevice[0].commPassword)).toBe("222");

    const cleared = await service.updateDevice(10, created.id, { comm_password: null } as any);
    expect(db.attendanceDevice[0].commPassword).toBeNull();
    expect(cleared.has_comm_password).toBe(false);
  });

  it("request-test sets testRequestedAt; the DTO never leaks secrets", async () => {
    const created = await service.createDevice(10, { name: "Gate", ip: "10.0.0.5" } as any);
    const r = await service.requestTest(10, created.id);
    expect(r.test_requested_at).toBe(NOW.toISOString());
    const dto = toDeviceDto(db.attendanceDevice[0] as any, NOW);
    expect(Object.keys(dto)).not.toContain("apiKeyHash");
    expect(JSON.stringify(dto)).not.toContain(db.attendanceDevice[0].apiKeyHash);
  });
});

describe("heartbeat + connector config", () => {
  it("heartbeat records status/contact/error, clears the test request and stores the result", async () => {
    const created = await service.createDevice(10, { name: "Gate", ip: "10.0.0.5", comm_password: "9999" } as any);
    await service.requestTest(10, created.id);
    const device = db.attendanceDevice[0] as any;

    const cfgBefore = ingest.getConnectorConfig(device);
    expect(cfgBefore.test_requested).toBe(true);
    expect(cfgBefore.comm_password).toBe("9999");

    await ingest.heartbeat(device, {
      device_id: device.deviceCode,
      device_status: "offline",
      error: "timeout\nconnecting",
      test_result: { ok: false, message: "connection timed out" },
      connector_version: "1.2.0",
    });

    expect(db.attendanceDevice[0]).toMatchObject({
      status: "offline",
      lastSeenAt: NOW,
      lastError: "timeout connecting",
      testRequestedAt: null,
      lastTestOk: false,
      lastTestMessage: "connection timed out",
      connectorVersion: "1.2.0",
    });
    expect(ingest.getConnectorConfig(db.attendanceDevice[0] as any).test_requested).toBe(false);
  });

  it("an online heartbeat stamps last_device_contact_at and clears the last error", async () => {
    const created = await service.createDevice(10, { name: "Gate", ip: "10.0.0.5" } as any);
    db.attendanceDevice[0].lastError = "old error";
    await ingest.heartbeat(db.attendanceDevice[0] as any, { device_id: created.device_id, device_status: "online" });
    expect(db.attendanceDevice[0]).toMatchObject({ status: "online", lastDeviceContactAt: NOW, lastError: null });
  });
});

describe("mappings", () => {
  const seedStudents = () => {
    db.student.push(
      { id: 1, madrasaId: 10, nameBn: "রহিম", classId: 1, isActive: 1, deletedAt: null, admissionStatus: "APPROVED" },
      { id: 2, madrasaId: 10, nameBn: "করিম", classId: 1, isActive: 1, deletedAt: null, admissionStatus: "APPROVED" },
      { id: 3, madrasaId: 20, nameBn: "অন্য মাদরাসা", classId: 1, isActive: 1, deletedAt: null, admissionStatus: "APPROVED" },
    );
  };

  it("maps a student, and a device_user_id already used by another student is a friendly 409", async () => {
    seedStudents();
    const ok = await service.setMapping(10, { student_id: 1, device_user_id: "101" });
    expect(ok).toMatchObject({ student_id: 1, device_user_id: "101" });

    await expect(service.setMapping(10, { student_id: 2, device_user_id: "101" })).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("রহিম"),
    });
    expect(db.attendanceDeviceUserMap).toHaveLength(1);
  });

  it("re-mapping the same student to a new device user replaces the old row", async () => {
    seedStudents();
    await service.setMapping(10, { student_id: 1, device_user_id: "101" });
    await service.setMapping(10, { student_id: 1, device_user_id: "102" });
    expect(db.attendanceDeviceUserMap.map((m) => m.deviceUserId)).toEqual(["102"]);
  });

  it("cannot map or unmap a student of another madrasa (404)", async () => {
    seedStudents();
    await expect(service.setMapping(10, { student_id: 3, device_user_id: "555" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.deleteMapping(10, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("creating a mapping back-fills earlier unmapped punches", async () => {
    seedStudents();
    await ingest.ingest({ id: 1, madrasaId: 10, deviceCode: "k40-a" } as any, {
      device_id: "k40-a",
      events: [{ event_id: "p1", device_user_id: "101", timestamp: "2026-09-20T08:15:00+06:00" }],
    } as any);
    expect(db.attendance).toHaveLength(0);

    const res = await service.setMapping(10, { student_id: 1, device_user_id: "101" });
    expect(res.reprocessed.logs).toBe(1);
    expect(db.attendance).toHaveLength(1);
  });
});
