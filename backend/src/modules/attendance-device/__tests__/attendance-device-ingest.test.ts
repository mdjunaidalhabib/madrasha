import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/config/env", () => ({
  env: {
    attendanceTimezone: "Asia/Dhaka",
    deviceSecretEncKey: "ab".repeat(32),
    smsMaxAttempts: 5,
  },
}));
vi.mock("../../../shared/logger/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../../shared/database/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { logger } from "../../../shared/logger/logger";
import { DEFAULT_NOTIFICATION_TEMPLATES } from "../../notifications/notification.constants";
import { AttendanceDeviceIngestService } from "../attendance-device-ingest.service";
import { db, resetDb } from "./fake-prisma";

// 2026-09-20 11:00 Dhaka
const NOW = new Date("2026-09-20T05:00:00.000Z");
const service = new AttendanceDeviceIngestService(undefined, () => NOW);

const deviceA: any = { id: 1, madrasaId: 10, deviceCode: "k40-a", name: "Gate", commPassword: null, pollIntervalSec: 30, testRequestedAt: null, status: "unknown" };

const ev = (over: Record<string, unknown> = {}) => ({
  event_id: "e1",
  device_user_id: "101",
  timestamp: "2026-09-20T08:15:00+06:00",
  verify_type: 1,
  in_out_state: 0,
  ...over,
});
const ingest = (events: unknown[], device = deviceA) => service.ingest(device, { device_id: device.deviceCode, events } as any);

const seedStudent = (over: Record<string, unknown> = {}) => {
  db.student.push({
    id: 501,
    madrasaId: 10,
    nameBn: "আব্দুল্লাহ",
    classId: 3,
    roll: 4,
    classRef: { nameBn: "হিফজ", name: "hifz" },
    guardianPhone: "01712345678",
    isActive: 1,
    deletedAt: null,
    admissionStatus: "APPROVED",
    fingerprintId: null,
    ...over,
  });
};
const seedMap = (deviceUserId = "101", studentId = 501, madrasaId = 10) =>
  db.attendanceDeviceUserMap.push({ id: db.seq++, madrasaId, deviceUserId, studentId });
// The existing অটো নোটিফিকেশন config: NotificationSetting(ATTENDANCE_PRESENT) + master switch.
const setSetting = (isEnabled: number, template = DEFAULT_NOTIFICATION_TEMPLATES.ATTENDANCE_PRESENT) =>
  db.notificationSetting.push({ madrasaId: 10, eventKey: "ATTENDANCE_PRESENT", isEnabled, template });
const setMaster = (on: number) => {
  db.madrasa.length = 0;
  db.madrasa.push({ id: 10, name: "জামিয়া", autoNotificationsEnabled: on });
};
const enableSms = (template?: string) => {
  setSetting(1, template);
  setMaster(1);
};

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
});

describe("ingest: idempotency", () => {
  it("a repeated event_id is 'duplicate' and creates no second log/attendance/SMS", async () => {
    seedStudent();
    seedMap();
    enableSms();

    const first = await ingest([ev()]);
    expect(first.results).toEqual([{ event_id: "e1", status: "accepted" }]);
    expect(db.attendanceDeviceLog).toHaveLength(1);
    expect(db.attendance).toHaveLength(1);
    expect(db.smsQueue).toHaveLength(1);

    const again = await ingest([ev()]);
    expect(again.results).toEqual([{ event_id: "e1", status: "duplicate" }]);
    expect(db.attendanceDeviceLog).toHaveLength(1);
    expect(db.attendance).toHaveLength(1);
    expect(db.smsQueue).toHaveLength(1);
  });

  it("the same physical punch under a different event_id is also a duplicate (second unique guard)", async () => {
    seedStudent();
    seedMap();
    await ingest([ev({ event_id: "e1" })]);
    const res = await ingest([ev({ event_id: "e2" })]);
    expect(res.results[0].status).toBe("duplicate");
    expect(db.attendanceDeviceLog).toHaveLength(1);
  });

  it("returns per-event results in order, mixing accepted/duplicate/rejected", async () => {
    seedStudent();
    seedMap();
    await ingest([ev({ event_id: "e1" })]);
    const res = await ingest([
      ev({ event_id: "e1" }),
      ev({ event_id: "e2", timestamp: "2026-09-20T09:00:00+06:00" }),
      ev({ event_id: "e3", timestamp: "not-a-date" }),
    ]);
    expect(res.results.map((r) => [r.event_id, r.status, r.reason])).toEqual([
      ["e1", "duplicate", undefined],
      ["e2", "accepted", undefined],
      ["e3", "rejected", "invalid_timestamp"],
    ]);
  });
});

describe("ingest: validation / rejection", () => {
  it("rejects a timestamp without a UTC offset instead of guessing", async () => {
    const res = await ingest([ev({ timestamp: "2026-09-20T08:15:00" })]);
    expect(res.results[0]).toEqual({ event_id: "e1", status: "rejected", reason: "invalid_timestamp" });
    expect(db.attendanceDeviceLog).toHaveLength(0);
  });

  it("stores far-future punches as FAILED with a reason and never marks attendance", async () => {
    seedStudent();
    seedMap();
    const res = await ingest([ev({ timestamp: "2026-10-30T08:15:00+06:00" })]);
    expect(res.results[0]).toEqual({ event_id: "e1", status: "rejected", reason: "timestamp_in_future" });
    expect(db.attendanceDeviceLog[0]).toMatchObject({ syncStatus: "FAILED", failReason: "timestamp_in_future" });
    expect(db.attendance).toHaveLength(0);
  });
});

describe("ingest: unmapped users", () => {
  it("accepts an unmapped device user with reason 'unmapped', stores studentId null, no attendance/SMS", async () => {
    enableSms();
    const res = await ingest([ev({ device_user_id: "999" })]);
    expect(res.results[0]).toEqual({ event_id: "e1", status: "accepted", reason: "unmapped" });
    expect(db.attendanceDeviceLog[0]).toMatchObject({ studentId: null, deviceUserId: "999", syncStatus: "SYNCED" });
    expect(db.attendance).toHaveLength(0);
    expect(db.smsQueue).toHaveLength(0);
    expect(res.summary.unmapped).toBe(1);
  });

  it("falls back to Student.fingerprintId when there is no map row", async () => {
    seedStudent({ fingerprintId: "777" });
    const res = await ingest([ev({ device_user_id: "777" })]);
    expect(res.results[0].status).toBe("accepted");
    expect(db.attendance).toHaveLength(1);
    expect(db.attendanceDeviceLog[0].studentId).toBe(501);
  });

  it("does not resolve inactive / non-approved / deleted students", async () => {
    seedStudent({ isActive: 0 });
    seedMap();
    const res = await ingest([ev()]);
    expect(res.results[0]).toEqual({ event_id: "e1", status: "accepted", reason: "student_inactive" });
    expect(db.attendance).toHaveLength(0);
    expect(db.attendanceDeviceLog[0]).toMatchObject({ studentId: null, failReason: "student_inactive" });
  });
});

describe("ingest: tenant isolation", () => {
  it("a map row of another madrasa is never used to resolve a student", async () => {
    seedStudent({ id: 900, madrasaId: 20 });
    seedMap("101", 900, 20); // madrasa 20 owns user 101
    const res = await ingest([ev()]); // device belongs to madrasa 10
    expect(res.results[0]).toEqual({ event_id: "e1", status: "accepted", reason: "unmapped" });
    expect(db.attendance).toHaveLength(0);
    expect(db.attendanceDeviceLog[0].madrasaId).toBe(10);
  });
});

describe("ingest: attendance rules", () => {
  it("creates PRESENT with source k40 and check-in time on the local (Dhaka) day", async () => {
    seedStudent();
    seedMap();
    // 00:30 Dhaka on 09-20 == 18:30Z on 09-19: must land on 09-20, not 09-19.
    await ingest([ev({ timestamp: "2026-09-19T18:30:00Z" })]);
    expect(db.attendance[0]).toMatchObject({ status: "PRESENT", source: "k40", attendeeId: 501, classId: 3 });
    expect(db.attendance[0].date.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(db.attendance[0].checkInAt.toISOString()).toBe("2026-09-19T18:30:00.000Z");
  });

  it("keeps the earliest punch as check-in and does not touch LEAVE/LATE status", async () => {
    seedStudent();
    seedMap();
    db.attendance.push({
      id: 77,
      madrasaId: 10,
      attendeeType: "STUDENT",
      attendeeId: 501,
      date: new Date("2026-09-20T00:00:00.000Z"),
      status: "LEAVE",
      source: "manual",
      checkInAt: null,
    });
    const res = await ingest([ev()]);
    expect(res.summary.attendance_marked).toBe(0);
    expect(db.attendance).toHaveLength(1);
    expect(db.attendance[0]).toMatchObject({ status: "LEAVE", source: "manual" });
    expect(db.attendance[0].checkInAt).toBeInstanceOf(Date);
  });

  it("upgrades ABSENT to PRESENT", async () => {
    seedStudent();
    seedMap();
    db.attendance.push({
      id: 78,
      madrasaId: 10,
      attendeeType: "STUDENT",
      attendeeId: 501,
      date: new Date("2026-09-20T00:00:00.000Z"),
      status: "ABSENT",
      source: "manual",
      checkInAt: null,
    });
    const res = await ingest([ev()]);
    expect(res.summary.attendance_marked).toBe(1);
    expect(db.attendance[0]).toMatchObject({ status: "PRESENT", source: "k40" });
  });
});

describe("ingest: SMS enqueue", () => {
  it("enqueues at most one SMS per student per day even with many punches and re-ingests", async () => {
    seedStudent();
    seedMap();
    enableSms();

    await ingest([ev({ event_id: "a", timestamp: "2026-09-20T08:15:00+06:00" })]);
    await ingest([ev({ event_id: "b", timestamp: "2026-09-20T08:16:00+06:00" })]);
    await ingest([ev({ event_id: "c", timestamp: "2026-09-20T09:01:00+06:00" })]);
    await ingest([ev({ event_id: "a", timestamp: "2026-09-20T08:15:00+06:00" })]);

    expect(db.smsQueue).toHaveLength(1);
    expect(db.smsQueue[0]).toMatchObject({
      dedupeKey: "attn:10:501:2026-09-20:present",
      recipient: "01712345678",
      studentId: 501,
      source: "attendance",
    });
    expect(db.smsQueue[0].message).toBe("আব্দুল্লাহ আজ 08:15 AM এ মাদরাসায় উপস্থিত হয়েছে (20/09/2026)। ধন্যবাদ।");
  });

  it("DEFAULT-DISABLED: with no NotificationSetting row nothing is enqueued (attendance still marked)", async () => {
    seedStudent();
    seedMap();
    setMaster(1); // master on, but the opt-in event has no row
    await ingest([ev()]);
    expect(db.attendance).toHaveLength(1);
    expect(db.smsQueue).toHaveLength(0);
  });

  it("no enqueue when the setting row exists but isEnabled = 0", async () => {
    seedStudent();
    seedMap();
    setMaster(1);
    setSetting(0);
    await ingest([ev()]);
    expect(db.smsQueue).toHaveLength(0);
  });

  it("no enqueue when the setting is enabled but the madrasa master switch is off", async () => {
    seedStudent();
    seedMap();
    setSetting(1);
    setMaster(0);
    await ingest([ev()]);
    expect(db.attendance).toHaveLength(1);
    expect(db.smsQueue).toHaveLength(0);
  });

  it("renders a custom template with {name} {class} {roll} {time} {date}", async () => {
    seedStudent();
    seedMap();
    enableSms("{name}/{class}/রোল {roll} @ {time} on {date} {unknown}");
    await ingest([ev()]);
    expect(db.smsQueue).toHaveLength(1);
    expect(db.smsQueue[0].message).toBe("আব্দুল্লাহ/হিফজ/রোল 4 @ 08:15 AM on 20/09/2026 {unknown}");
  });

  it("uses guardianPhone only, as stored (no guardianPhone2 fallback or reformatting)", async () => {
    seedStudent({ guardianPhone: null, guardianPhone2: "01898765432" });
    seedMap();
    enableSms();
    await ingest([ev()]);
    expect(db.smsQueue).toHaveLength(0);
  });

  it("does not SMS for backlog punches from a previous day", async () => {
    seedStudent();
    seedMap();
    enableSms();
    await ingest([ev({ timestamp: "2026-09-18T08:15:00+06:00" })]);
    expect(db.attendance).toHaveLength(1);
    expect(db.smsQueue).toHaveLength(0);
  });

  it("does NOT enqueue an SMS when the attendance write fails (and rolls the log back)", async () => {
    seedStudent();
    seedMap();
    enableSms();
    db.failAttendanceCreate = true;

    await expect(ingest([ev()])).rejects.toThrow("simulated attendance write failure");
    expect(db.smsQueue).toHaveLength(0);
    expect(db.attendanceDeviceLog).toHaveLength(0);
    expect(db.attendance).toHaveLength(0);
  });

  it("skips SMS when the guardian has no phone, without failing ingest", async () => {
    seedStudent({ guardianPhone: null });
    seedMap();
    enableSms();
    const res = await ingest([ev()]);
    expect(res.results[0].status).toBe("accepted");
    expect(db.smsQueue).toHaveLength(0);
  });

  it("never logs the guardian's full phone number", async () => {
    seedStudent();
    seedMap();
    enableSms();
    await ingest([ev()]);
    const logged = JSON.stringify(
      [...(logger.info as any).mock.calls, ...(logger.warn as any).mock.calls, ...(logger.error as any).mock.calls],
    );
    expect(logged).not.toContain("01712345678");
    expect(logged).toContain("017****78");
  });
});

describe("reprocess unmapped logs", () => {
  it("applies past unmapped punches after a mapping is created (SMS only for today)", async () => {
    seedStudent();
    enableSms();
    await ingest([
      ev({ event_id: "old", timestamp: "2026-09-18T08:00:00+06:00" }),
      ev({ event_id: "today", timestamp: "2026-09-20T08:15:00+06:00" }),
    ]);
    expect(db.attendance).toHaveLength(0);

    seedMap();
    const totals = await service.reprocessUnmapped(10, "101", 501);
    expect(totals).toEqual({ logs: 2, attendance_marked: 2, sms_enqueued: 1 });
    expect(db.attendance.map((a) => a.date.toISOString().slice(0, 10)).sort()).toEqual(["2026-09-18", "2026-09-20"]);
    expect(db.attendanceDeviceLog.every((l) => l.studentId === 501)).toBe(true);
    expect(db.smsQueue).toHaveLength(1);
    expect(db.smsQueue[0].dedupeKey).toBe("attn:10:501:2026-09-20:present");

    // idempotent: nothing left unprocessed
    expect((await service.reprocessUnmapped(10, "101", 501)).logs).toBe(0);
  });
});
