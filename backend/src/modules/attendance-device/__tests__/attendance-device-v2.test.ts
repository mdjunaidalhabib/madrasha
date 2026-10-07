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

import { DEFAULT_NOTIFICATION_TEMPLATES } from "../../notifications/notification.constants";
import { AttendanceDeviceIngestService } from "../attendance-device-ingest.service";
import { AttendanceDevicePeopleService } from "../attendance-device-people.service";
import { AttendanceDeviceSettingsService } from "../attendance-device-settings.service";
import { AttendanceDeviceEnrollmentService } from "../attendance-device-enrollment.service";
import { AttendanceDeviceJobsService } from "../attendance-device-jobs.service";
import { AttendanceDeviceService } from "../attendance-device.service";
import { attendanceDevicePeopleRepository } from "../attendance-device-people.repository";
import { attendanceDeviceEnrollmentRepository } from "../attendance-device-enrollment.repository";
import { attendanceDeviceJobsRepository } from "../attendance-device-jobs.repository";
import { attendanceDeviceSettingsRepository } from "../attendance-device-settings.repository";
import { arrivalStatus, deviceUserName, normalizeCardNumber, withDefaultRules } from "../attendance-device-rules";
import { db, resetDb } from "./fake-prisma";

// 2026-09-20 is a Sunday. NOW = 11:00 Dhaka.
let NOW = new Date("2026-09-20T05:00:00.000Z");
const clock = () => NOW;

const settings = new AttendanceDeviceSettingsService(undefined, clock);
const people = new AttendanceDevicePeopleService(undefined, settings);
const ingest = new AttendanceDeviceIngestService(undefined, clock, undefined, settings, people);
const enrollment = new AttendanceDeviceEnrollmentService(
  attendanceDeviceEnrollmentRepository,
  people,
  attendanceDevicePeopleRepository,
  clock,
  async () => undefined,
);
const jobs = new AttendanceDeviceJobsService(
  attendanceDeviceJobsRepository,
  attendanceDeviceSettingsRepository,
  settings,
  attendanceDevicePeopleRepository,
  ingest,
  clock,
);
const admin = new AttendanceDeviceService(undefined, ingest, clock, people, attendanceDevicePeopleRepository, settings);

const device: any = {
  id: 1,
  madrasaId: 10,
  deviceCode: "k40-a",
  name: "Gate",
  commPassword: null,
  pollIntervalSec: 30,
  testRequestedAt: null,
  status: "online",
  isActive: true,
  lastSeenAt: NOW,
};

const student = (over: Record<string, unknown> = {}) => ({
  id: 501,
  madrasaId: 10,
  nameBn: "আব্দুল্লাহ",
  nameEn: "Abdullah Al-Mamun",
  classId: 3,
  roll: 4,
  classRef: { nameBn: "হিফজ", name: "hifz" },
  guardianPhone: "01712345678",
  isActive: 1,
  deletedAt: null,
  admissionStatus: "APPROVED",
  fingerprintId: null,
  registrationNo: 77,
  image: null,
  ...over,
});
const teacher = (over: Record<string, unknown> = {}) => ({
  id: 301,
  madrasaId: 10,
  nameBn: "উস্তাদ করিম",
  nameEn: "Karim (Ustad)",
  registrationNo: 5,
  designation: "শিক্ষক",
  image: null,
  isActive: null,
  deletedAt: null,
  ...over,
});
const map = (deviceUserId: string, ref: Record<string, number>, over: Record<string, unknown> = {}) =>
  db.attendanceDeviceUserMap.push({
    id: db.seq++,
    madrasaId: 10,
    deviceUserId,
    attendeeType: ref.teacherId ? "TEACHER" : ref.staffId ? "STAFF" : "STUDENT",
    studentId: null,
    teacherId: null,
    staffId: null,
    cardNumber: null,
    autoAssigned: true,
    ...ref,
    ...over,
  });
const setRules = (over: Record<string, unknown>) =>
  db.attendanceDeviceSettings.push({ id: db.seq++, madrasaId: 10, ...withDefaultRules(null), ...over });
const enableEvent = (eventKey: string, template?: string) => {
  if (!db.madrasa.length) db.madrasa.push({ id: 10, name: "জামিয়া", autoNotificationsEnabled: 1, phone: "01999999999" });
  db.notificationSetting.push({
    madrasaId: 10,
    eventKey,
    isEnabled: 1,
    template: template ?? (DEFAULT_NOTIFICATION_TEMPLATES as Record<string, string>)[eventKey],
  });
};
const punch = (deviceUserId: string, timestamp: string, eventId = `${deviceUserId}@${timestamp}`) =>
  ingest.ingest(device, { device_id: "k40-a", events: [{ event_id: eventId, device_user_id: deviceUserId, timestamp }] } as any);

beforeEach(() => {
  resetDb();
  NOW = new Date("2026-09-20T05:00:00.000Z");
  device.lastSeenAt = NOW;
  db.attendanceDevice.push({ ...device });
});

/* ================= pure rules ================= */

describe("rules helpers", () => {
  it("late = after start + grace at minute precision; teachers use teacher_start_time", () => {
    const r = { lateEnabled: true, studentStartTime: "08:00", teacherStartTime: "07:30", lateGraceMinutes: 10 };
    expect(arrivalStatus(r, "STUDENT", new Date("2026-09-20T08:10:59+06:00"), "Asia/Dhaka")).toBe("PRESENT");
    expect(arrivalStatus(r, "STUDENT", new Date("2026-09-20T08:11:00+06:00"), "Asia/Dhaka")).toBe("LATE");
    expect(arrivalStatus(r, "TEACHER", new Date("2026-09-20T07:45:00+06:00"), "Asia/Dhaka")).toBe("LATE");
    expect(arrivalStatus({ ...r, lateEnabled: false }, "STUDENT", new Date("2026-09-20T11:00:00+06:00"), "Asia/Dhaka")).toBe("PRESENT");
  });

  it("K40 names are ASCII, max 24 bytes, with a type prefix fallback", () => {
    expect(deviceUserName("STUDENT", "Abdullah Al-Mamun", "10001")).toBe("Abdullah Al-Mamun");
    expect(deviceUserName("STUDENT", "আব্দুল্লাহ", "10001")).toBe("ST-10001");
    expect(deviceUserName("TEACHER", null, "7")).toBe("TR-7");
    expect(deviceUserName("STAFF", "Md. Rahim_Uddin (Peon) Very Long Name Here", "9")).toBe("Md. RahimUddin Peon Very");
  });

  it("card numbers: digits only, leading zeros stripped, 0 invalid", () => {
    expect(normalizeCardNumber("0012345")).toBe("12345");
    expect(normalizeCardNumber(987)).toBe("987");
    expect(normalizeCardNumber("000")).toBeNull();
    expect(normalizeCardNumber("০০৪৫১২")).toBe("4512");
    expect(normalizeCardNumber("12a")).toBeNull();
    expect(normalizeCardNumber("1".repeat(21))).toBeNull();
  });
});

/* ================= PIN allocation ================= */

describe("PIN allocation", () => {
  it("auto mode: starts at pin_start (default 10001) and skips PINs used by maps and unmapped K40 users", async () => {
    setRules({ pinMode: "auto" });
    db.student.push(student(), student({ id: 502, roll: 5 }));
    map("10001", { studentId: 999 });
    db.attendanceDeviceLog.push({ id: db.seq++, madrasaId: 10, deviceUserId: "10002", studentId: null, teacherId: null, staffId: null });
    // a log of a mapped person does NOT block the PIN
    db.attendanceDeviceLog.push({ id: db.seq++, madrasaId: 10, deviceUserId: "10003", studentId: 7, teacherId: null, staffId: null });

    const m = await people.ensureMap(10, { type: "STUDENT", id: 501 });
    expect(m).toMatchObject({ deviceUserId: "10003", autoAssigned: true, studentId: 501, attendeeType: "STUDENT" });
    // idempotent
    expect((await people.ensureMap(10, { type: "STUDENT", id: 501 })).deviceUserId).toBe("10003");
    expect((await people.ensureMap(10, { type: "STUDENT", id: 502 })).deviceUserId).toBe("10004");
  });

  it("honours settings.pin_start and never reuses another madrasa's numbering", async () => {
    setRules({ pinMode: "auto", pinStart: 500 });
    db.student.push(student());
    db.attendanceDeviceUserMap.push({ id: db.seq++, madrasaId: 20, deviceUserId: "500", studentId: 1, attendeeType: "STUDENT" });
    expect((await people.ensureMap(10, { type: "STUDENT", id: 501 })).deviceUserId).toBe("500");
  });

  it("assign-pins gives every eligible person of the type a PIN (inactive/other types skipped)", async () => {
    setRules({ pinMode: "auto" });
    db.student.push(student(), student({ id: 502, roll: 5 }), student({ id: 503, isActive: 0 }));
    db.teacher.push(teacher(), teacher({ id: 302, isActive: 0 }), teacher({ id: 303, isActive: 1 }));
    map("10001", { studentId: 501 });

    expect(await people.assignPins(10, { attendee_type: "STUDENT" })).toEqual({ created: 1 });
    expect(await people.assignPins(10, { attendee_type: "TEACHER" })).toEqual({ created: 2 });
    expect(await people.assignPins(10, { attendee_type: "TEACHER" })).toEqual({ created: 0 });
    const pins = db.attendanceDeviceUserMap.map((m) => [m.attendeeType, m.studentId ?? m.teacherId, m.deviceUserId]);
    expect(pins).toEqual([
      ["STUDENT", 501, "10001"],
      ["STUDENT", 502, "10002"],
      ["TEACHER", 301, "10003"],
      ["TEACHER", 303, "10004"],
    ]);
  });

  it("setCard: creates the map with a PIN, and a card of somebody else is a 409", async () => {
    db.student.push(student(), student({ id: 502, nameBn: "করিম", registrationNo: 78 }));
    const item = await people.setCard(10, { attendee_type: "STUDENT", attendee_id: 501, card_number: "00123" });
    expect(item).toMatchObject({ attendee_id: 501, device_user_id: "77", card_number: "123" });
    await expect(people.setCard(10, { attendee_type: "STUDENT", attendee_id: 502, card_number: "123" })).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("আব্দুল্লাহ"),
    });
    await people.clearCard(10, { type: "STUDENT", id: 501 });
    expect(db.attendanceDeviceUserMap[0].cardNumber).toBeNull();
  });
});

describe("PIN = registration number (default pin_mode)", () => {
  it("student = reg no, teacher = 90000 + reg no, staff = 95000 + reg no", async () => {
    db.student.push(student());
    db.teacher.push(teacher());
    db.staff.push({ id: 401, madrasaId: 10, nameBn: "খাদেম", nameEn: null, registrationNo: 3, isActive: 1, deletedAt: null });
    expect((await people.ensureMap(10, { type: "STUDENT", id: 501 })).deviceUserId).toBe("77");
    expect((await people.ensureMap(10, { type: "TEACHER", id: 301 })).deviceUserId).toBe("90005");
    expect((await people.ensureMap(10, { type: "STAFF", id: 401 })).deviceUserId).toBe("95003");
  });

  it("falls back to the auto PIN when the reg no is missing or its PIN is taken (also as a previous PIN)", async () => {
    db.student.push(student(), student({ id: 502, registrationNo: null }), student({ id: 503, registrationNo: 88 }));
    map("77", { studentId: 999 }, { autoAssigned: false });
    map("12345", { studentId: 998 }, { previousDeviceUserId: "88" });
    expect((await people.ensureMap(10, { type: "STUDENT", id: 501 })).deviceUserId).toBe("10001");
    expect((await people.ensureMap(10, { type: "STUDENT", id: 502 })).deviceUserId).toBe("10002");
    expect((await people.ensureMap(10, { type: "STUDENT", id: 503 })).deviceUserId).toBe("10003");
  });

  it("assign-pins hands out registration PINs first, then auto PINs", async () => {
    db.student.push(student(), student({ id: 502, registrationNo: null }));
    expect(await people.assignPins(10, { attendee_type: "STUDENT" })).toEqual({ created: 2 });
    const pins = Object.fromEntries(db.attendanceDeviceUserMap.map((m) => [m.studentId, m.deviceUserId]));
    expect(pins).toEqual({ 501: "77", 502: "10001" });
  });

  it("convert-pins moves only auto-assigned PINs, keeps the old one as previous; punches under it still resolve", async () => {
    db.student.push(student(), student({ id: 502, registrationNo: 78 }), student({ id: 503, registrationNo: 79 }));
    map("10001", { studentId: 501 });
    map("4242", { studentId: 502 }, { autoAssigned: false });
    map("79", { studentId: 503 });

    expect(await people.convertPins(10, {})).toEqual({ changed: 1, skipped: 0 });
    expect(db.attendanceDeviceUserMap[0]).toMatchObject({ deviceUserId: "77", previousDeviceUserId: "10001" });
    expect(db.attendanceDeviceUserMap[1].deviceUserId).toBe("4242");
    expect(db.attendanceDeviceUserMap[1].previousDeviceUserId ?? null).toBeNull();
    expect(await people.convertPins(10, {})).toEqual({ changed: 0, skipped: 0 });

    const users = await people.connectorUsers(10);
    expect(users.users.find((u) => u.pin === "77")).toMatchObject({ prev_pin: "10001" });

    const res = await punch("10001", "2026-09-20T08:00:00+06:00");
    expect(res.results[0]).toEqual({ event_id: expect.any(String), status: "accepted" });
    expect(db.attendance[0]).toMatchObject({ attendeeType: "STUDENT", attendeeId: 501 });
  });

  it("convert-pins skips a PIN used by someone else and is refused in auto mode", async () => {
    db.student.push(student(), student({ id: 502, registrationNo: 78 }));
    map("10001", { studentId: 501 });
    map("77", { studentId: 502 }, { autoAssigned: false });
    expect(await people.convertPins(10, { attendee_type: "STUDENT" })).toEqual({ changed: 0, skipped: 1 });

    db.attendanceDeviceSettings.length = 0;
    setRules({ pinMode: "auto" });
    await expect(people.convertPins(10, {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("pin_warnings when registration numbers reach the teacher / staff ranges", async () => {
    expect(await people.pinWarnings(10)).toEqual([]);
    db.student.push(student({ registrationNo: 90000 }));
    db.teacher.push(teacher({ registrationNo: 5000 }));
    expect(await people.pinWarnings(10)).toHaveLength(2);
  });
});

/* ================= connector users list ================= */

describe("connector users list / version", () => {
  it("lists eligible mapped people sorted by PIN with ASCII names; version follows content", async () => {
    db.student.push(student(), student({ id: 502, nameEn: null, isActive: 0 }));
    db.teacher.push(teacher());
    map("10010", { studentId: 501 }, { cardNumber: "555" });
    map("9", { teacherId: 301 });
    map("10002", { studentId: 502 });

    const a = await people.connectorUsers(10);
    expect(a.users).toEqual([
      { pin: "9", name: "Karim Ustad", card: null, attendee_type: "TEACHER", prev_pin: null },
      { pin: "10010", name: "Abdullah Al-Mamun", card: "555", attendee_type: "STUDENT", prev_pin: null },
    ]);
    expect(a.version).toMatch(/^[0-9a-f]{64}$/);
    expect((await people.connectorUsers(10)).version).toBe(a.version);

    db.attendanceDeviceUserMap[1].cardNumber = "777";
    expect((await people.connectorUsers(10)).version).not.toBe(a.version);

    const cfg = await ingest.getConnectorConfig(db.attendanceDevice[0] as any);
    expect(cfg).toMatchObject({ users_version: (await people.connectorUsers(10)).version, auto_time_sync: true });
  });

  it("heartbeat stores telemetry, stamps last_user_sync_at and re-arms the offline alert when online", async () => {
    db.attendanceDevice[0].offlineAlertedAt = new Date("2026-09-20T04:00:00Z");
    const res = await ingest.heartbeat(db.attendanceDevice[0] as any, {
      device_id: "k40-a",
      device_status: "online",
      clock_drift_sec: -75,
      users_synced_version: "abc",
      user_sync_error: null,
      device_user_count: 42,
    });
    expect(db.attendanceDevice[0]).toMatchObject({
      clockDriftSec: -75,
      usersSyncedVersion: "abc",
      lastUserSyncAt: NOW,
      userSyncError: null,
      deviceUserCount: 42,
      offlineAlertedAt: null,
    });
    expect(res.users_version).toMatch(/^[0-9a-f]{64}$/);

    const [dto] = await admin.listDevices(10);
    expect(dto).toMatchObject({ clock_drift_sec: -75, users_synced_version: "abc", users_in_sync: false, device_user_count: 42 });
  });
});

/* ================= attendance rules ================= */

describe("ingest rules: late / check-out / holiday / teachers", () => {
  beforeEach(() => {
    db.student.push(student());
    map("10001", { studentId: 501 });
  });

  it("LATE after start + grace, with {status} in the arrival SMS", async () => {
    setRules({ lateEnabled: true, studentStartTime: "08:00", lateGraceMinutes: 10 });
    enableEvent("ATTENDANCE_PRESENT");
    await punch("10001", "2026-09-20T08:25:00+06:00");
    expect(db.attendance[0]).toMatchObject({ status: "LATE", source: "k40" });
    expect(db.smsQueue[0].message).toBe("আব্দুল্লাহ আজ 08:25 AM এ মাদরাসায় দেরিতে উপস্থিত হয়েছে (20/09/2026)। ধন্যবাদ।");
  });

  it("an on-time punch keeps the old default SMS text", async () => {
    setRules({ lateEnabled: true });
    enableEvent("ATTENDANCE_PRESENT");
    await punch("10001", "2026-09-20T07:55:00+06:00");
    expect(db.attendance[0].status).toBe("PRESENT");
    expect(db.smsQueue[0].message).toBe("আব্দুল্লাহ আজ 07:55 AM এ মাদরাসায় উপস্থিত হয়েছে (20/09/2026)। ধন্যবাদ।");
  });

  it("auto ABSENT is upgraded to LATE by a late punch", async () => {
    setRules({ lateEnabled: true });
    db.attendance.push({ id: 90, madrasaId: 10, attendeeType: "STUDENT", attendeeId: 501, date: new Date("2026-09-20T00:00:00Z"), status: "ABSENT", source: "auto", checkInAt: null });
    const res = await punch("10001", "2026-09-20T10:45:00+06:00");
    expect(res.summary.attendance_marked).toBe(1);
    expect(db.attendance[0]).toMatchObject({ status: "LATE", source: "k40" });
  });

  it("check-out: only after checkout_after_time and >= 30 min after check-in; first one queues the checkout SMS", async () => {
    setRules({ checkoutEnabled: true, checkoutAfterTime: "12:00" });
    enableEvent("ATTENDANCE_CHECKOUT");
    NOW = new Date("2026-09-20T09:00:00.000Z"); // 15:00 Dhaka

    await punch("10001", "2026-09-20T11:50:00+06:00");
    await punch("10001", "2026-09-20T12:10:00+06:00"); // in window but only 20 min after check-in
    expect(db.attendance[0].checkOutAt ?? null).toBeNull();
    expect(db.attendance[0].checkInAt.toISOString()).toBe("2026-09-20T05:50:00.000Z");

    await punch("10001", "2026-09-20T13:30:00+06:00");
    await punch("10001", "2026-09-20T14:00:00+06:00");
    expect(db.attendance).toHaveLength(1);
    expect(db.attendance[0].checkOutAt.toISOString()).toBe("2026-09-20T08:00:00.000Z");
    expect(db.smsQueue).toHaveLength(1);
    expect(db.smsQueue[0]).toMatchObject({ dedupeKey: "attn:10:501:2026-09-20:checkout" });
    expect(db.smsQueue[0].message).toBe("আব্দুল্লাহ আজ 01:30 PM এ মাদরাসা থেকে বের হয়েছে (20/09/2026)।");
  });

  it("a first punch after checkout time is still a check-in", async () => {
    setRules({ checkoutEnabled: true, checkoutAfterTime: "12:00" });
    NOW = new Date("2026-09-20T09:00:00.000Z");
    await punch("10001", "2026-09-20T13:00:00+06:00");
    expect(db.attendance[0]).toMatchObject({ status: "PRESENT" });
    expect(db.attendance[0].checkOutAt ?? null).toBeNull();
  });

  it("holiday: the punch is logged with reason 'holiday' but no attendance / SMS", async () => {
    enableEvent("ATTENDANCE_PRESENT");
    await settings.createHoliday(10, { date: "2026-09-20", title: "বিশেষ ছুটি" });
    const res = await punch("10001", "2026-09-20T08:00:00+06:00");
    expect(res.results[0]).toMatchObject({ status: "accepted", reason: "holiday" });
    expect(db.attendanceDeviceLog[0]).toMatchObject({ failReason: "holiday", studentId: 501 });
    expect(db.attendance).toHaveLength(0);
    expect(db.smsQueue).toHaveLength(0);

    const today = await admin.today(10, { date: "2026-09-20" });
    expect(today).toMatchObject({ is_holiday: true, holiday_title: "বিশেষ ছুটি" });
  });

  it("no weekly off day until configured; a configured Friday creates no attendance", async () => {
    const before = await punch("10001", "2026-09-11T08:00:00+06:00");
    expect(before.results[0].reason).toBeUndefined();
    expect(db.attendance).toHaveLength(1);
    db.attendance.length = 0;
    setRules({ weeklyOffDays: [5] });
    const res = await punch("10001", "2026-09-18T08:00:00+06:00");
    expect(res.results[0].reason).toBe("holiday");
    expect(db.attendance).toHaveLength(0);
  });

  it("teacher punches create TEACHER rows (no class, no SMS)", async () => {
    setRules({ lateEnabled: true, teacherStartTime: "07:30", lateGraceMinutes: 0 });
    enableEvent("ATTENDANCE_PRESENT");
    db.teacher.push(teacher());
    map("9", { teacherId: 301 });
    await punch("9", "2026-09-20T07:40:00+06:00");
    expect(db.attendance[0]).toMatchObject({ attendeeType: "TEACHER", attendeeId: 301, classId: null, status: "LATE" });
    expect(db.attendanceDeviceLog[0]).toMatchObject({ teacherId: 301, studentId: null });
    expect(db.smsQueue).toHaveLength(0);

    const today = await admin.today(10, { date: "2026-09-20", attendee_type: "TEACHER" });
    expect(today.summary).toMatchObject({ present: 0, late: 1, mapped_total: 1 });
    expect(today.items[0]).toMatchObject({ attendee_type: "TEACHER", attendee_id: 301, student_id: null, status: "LATE" });
    expect(today.classes).toEqual([]);
  });

  it("an inactive teacher is logged as 'inactive' without attendance", async () => {
    db.teacher.push(teacher({ isActive: 0 }));
    map("9", { teacherId: 301 });
    const res = await punch("9", "2026-09-20T07:40:00+06:00");
    expect(res.results[0].reason).toBe("inactive");
    expect(db.attendance).toHaveLength(0);
  });

  it("today report lists not-arrived mapped students and per-class totals", async () => {
    db.student.push(student({ id: 502, roll: 6, nameBn: "করিম" }));
    map("10002", { studentId: 502 });
    await punch("10001", "2026-09-20T08:00:00+06:00");
    const today = await admin.today(10, { date: "2026-09-20" });
    expect(today.summary).toMatchObject({ present: 1, late: 0, not_arrived: 1, mapped_total: 2, unmapped: 0 });
    expect(today.not_arrived).toEqual([{ attendee_id: 502, name: "করিম", roll: 6, class_id: 3, class_name: "হিফজ", status: null }]);
    expect(today.classes).toEqual([{ class_id: 3, class_name: "হিফজ", mapped_total: 2, present: 1, late: 0, absent: 0 }]);
    expect(today.items[0]).toMatchObject({ student_id: 501, student_name: "আব্দুল্লাহ", status: "PRESENT", check_out_at: null });
  });
});

/* ================= enrollment ================= */

describe("card enrollment", () => {
  beforeEach(() => {
    setRules({ pinMode: "auto" });
    db.student.push(student(), student({ id: 502, nameBn: "করিম", nameEn: "Karim" }));
  });

  it("admin start -> connector command -> waiting -> captured saves the card", async () => {
    const e = await enrollment.create(10, 1, { attendee_type: "STUDENT", attendee_id: 501 });
    expect(e).toMatchObject({ status: "pending", device_id: 1, device_user_id: "10001", person_name: "আব্দুল্লাহ", connector_online: true });
    expect(db.attendanceDeviceUserMap[0]).toMatchObject({ studentId: 501, deviceUserId: "10001", autoAssigned: true });

    const cmd = await enrollment.commands(db.attendanceDevice[0] as any, 0);
    expect(cmd.enrollment).toMatchObject({ id: e.id, device_user_id: "10001", name: "Abdullah Al-Mamun", card_number: null, attendee_type: "STUDENT" });
    expect(cmd.users_version).toMatch(/^[0-9a-f]{64}$/);

    expect(await enrollment.report(db.attendanceDevice[0] as any, e.id, { status: "waiting", message: "user written" })).toEqual({ ok: true, status: "waiting" });
    // WAITING is no longer handed out as a command
    expect((await enrollment.commands(db.attendanceDevice[0] as any, 0)).enrollment).toBeNull();

    const done = await enrollment.report(db.attendanceDevice[0] as any, e.id, { status: "captured", card_number: "0004512345" });
    expect(done).toEqual({ ok: true, status: "completed", user: { pin: "10001", name: "Abdullah Al-Mamun", card: "4512345" } });
    expect(db.attendanceDeviceUserMap[0].cardNumber).toBe("4512345");
    expect(await enrollment.get(10, e.id)).toMatchObject({ status: "completed", card_number: "4512345" });

    // terminal: later reports are refused
    expect(await enrollment.report(db.attendanceDevice[0] as any, e.id, { status: "waiting" })).toEqual({ ok: false, status: "completed" });
  });

  it("a card already used by another person fails the enrollment", async () => {
    await people.setCard(10, { attendee_type: "STUDENT", attendee_id: 502, card_number: "777" });
    const e = await enrollment.create(10, null, { attendee_type: "STUDENT", attendee_id: 501 });
    const res = await enrollment.report(db.attendanceDevice[0] as any, e.id, { status: "captured", card_number: "777" });
    expect(res).toEqual({ ok: false, status: "failed", message: "card already used by করিম" });
    expect(db.attendanceDeviceUserMap.find((m) => m.studentId === 501)?.cardNumber ?? null).toBeNull();
    expect(await enrollment.get(10, e.id)).toMatchObject({ status: "failed" });
  });

  it("a new enrollment cancels the open one; cancelled / expired sessions answer ok:false", async () => {
    const first = await enrollment.create(10, null, { attendee_type: "STUDENT", attendee_id: 501 });
    const second = await enrollment.create(10, null, { attendee_type: "STUDENT", attendee_id: 502 });
    expect(await enrollment.report(db.attendanceDevice[0] as any, first.id, { status: "waiting" })).toEqual({ ok: false, status: "cancelled" });

    NOW = new Date(NOW.getTime() + 121_000);
    expect(await enrollment.get(10, second.id)).toMatchObject({ status: "expired" });
    expect(await enrollment.report(db.attendanceDevice[0] as any, second.id, { status: "captured", card_number: "1" })).toEqual({ ok: false, status: "expired" });
  });

  it("another device's enrollment is a 404 for this connector; several active devices require device_id", async () => {
    db.attendanceDevice.push({ ...device, id: 2, deviceCode: "k40-b" });
    await expect(enrollment.create(10, null, { attendee_type: "STUDENT", attendee_id: 501 })).rejects.toMatchObject({ statusCode: 400 });
    const e = await enrollment.create(10, null, { attendee_type: "STUDENT", attendee_id: 501, device_id: 2 });
    await expect(enrollment.report(db.attendanceDevice[0] as any, e.id, { status: "waiting" })).rejects.toMatchObject({ statusCode: 404 });
  });
});

/* ================= auto absent job ================= */

describe("auto absent job", () => {
  beforeEach(() => {
    db.student.push(student(), student({ id: 502, roll: 5, nameBn: "করিম" }), student({ id: 503, isActive: 0 }));
    db.teacher.push(teacher());
    map("10001", { studentId: 501 });
    map("10002", { studentId: 502 });
    map("10003", { studentId: 503 });
    map("9", { teacherId: 301 });
    setRules({ autoAbsentEnabled: true, absentCutoffTime: "10:30" });
    enableEvent("ATTENDANCE_ABSENT");
    // Device synced: read after the cutoff (11:00 Dhaka) with an empty queue.
    db.attendanceDevice[0].lastDeviceContactAt = NOW;
    db.attendanceDevice[0].queuePending = 0;
  });

  it("waits while a device still has queued punches, then runs once the queue is empty", async () => {
    db.attendanceDevice[0].queuePending = 3;
    expect(await jobs.runAutoAbsent()).toEqual({ madrasas: 0, marked: 0, sms_enqueued: 0 });
    expect(db.attendance).toHaveLength(0);

    // the late punch arrives, then a heartbeat reports the queue drained
    await punch("10002", "2026-09-20T08:10:00+06:00");
    await ingest.heartbeat(db.attendanceDevice[0] as any, { device_id: "k40-a", device_status: "online", queue_pending: 0 } as any);
    const r = await jobs.runAutoAbsent();
    // 501 + teacher absent; 502 punched (late sync) and is NOT marked absent
    expect(r).toEqual({ madrasas: 1, marked: 2, sms_enqueued: 1 });
    expect(db.smsQueue.map((s) => s.dedupeKey)).toEqual(["attn:10:501:2026-09-20:absent"]);
    expect(db.attendance.find((a) => a.attendeeId === 502)).toMatchObject({ status: "PRESENT", source: "k40" });
  });

  it("waits while the device was not read after the cutoff (offline), up to the max wait", async () => {
    db.attendanceDevice[0].lastDeviceContactAt = new Date("2026-09-20T09:00:00+06:00");
    expect(await jobs.runAutoAbsent()).toEqual({ madrasas: 0, marked: 0, sms_enqueued: 0 });

    NOW = new Date("2026-09-20T12:31:00+06:00"); // cutoff 10:30 + 120 min default wait passed
    db.attendanceDevice[0].lastSeenAt = NOW;
    expect(await jobs.runAutoAbsent()).toMatchObject({ madrasas: 1, marked: 3 });
  });

  it("does not wait when the max wait is 0, nor for a device that was never set up", async () => {
    db.attendanceDeviceSettings[0].autoAbsentMaxWaitMinutes = 0;
    db.attendanceDevice[0].queuePending = 5;
    expect(await jobs.runAutoAbsent()).toMatchObject({ madrasas: 1 });

    db.attendance.length = 0;
    db.attendanceDeviceSettings[0].autoAbsentMaxWaitMinutes = 120;
    db.attendanceDeviceSettings[0].lastAutoAbsentDate = null;
    db.attendanceDevice[0].lastSeenAt = null;
    expect(await jobs.runAutoAbsent()).toMatchObject({ madrasas: 1 });
  });

  it("marks every mapped eligible person without a row ABSENT once, with one SMS per student", async () => {
    await punch("10001", "2026-09-20T08:00:00+06:00");

    const first = await jobs.runAutoAbsent();
    expect(first).toEqual({ madrasas: 1, marked: 2, sms_enqueued: 1 });
    const absent = db.attendance.filter((a) => a.status === "ABSENT");
    expect(absent.map((a) => [a.attendeeType, a.attendeeId, a.source, a.classId ?? null]).sort()).toEqual([
      ["STUDENT", 502, "auto", 3],
      ["TEACHER", 301, "auto", null],
    ]);
    expect(db.smsQueue).toHaveLength(1);
    expect(db.smsQueue[0]).toMatchObject({ dedupeKey: "attn:10:502:2026-09-20:absent" });
    expect(db.smsQueue[0].message).toBe("করিম আজ (20/09/2026) মাদরাসায় অনুপস্থিত। কারণ জানাতে অফিসে যোগাযোগ করুন।");
    expect(db.attendanceDeviceSettings[0].lastAutoAbsentDate.toISOString()).toBe("2026-09-20T00:00:00.000Z");

    // second pass the same day: nothing
    expect(await jobs.runAutoAbsent()).toEqual({ madrasas: 0, marked: 0, sms_enqueued: 0 });
    // even if the day marker is lost, rows + SMS stay single
    db.attendanceDeviceSettings[0].lastAutoAbsentDate = null;
    expect(await jobs.runAutoAbsent()).toEqual({ madrasas: 1, marked: 0, sms_enqueued: 0 });
    expect(db.attendance).toHaveLength(3);
    expect(db.smsQueue).toHaveLength(1);
  });

  it("does nothing before the cutoff time or on a holiday", async () => {
    NOW = new Date("2026-09-20T04:00:00.000Z"); // 10:00 Dhaka
    expect(await jobs.runAutoAbsent()).toEqual({ madrasas: 0, marked: 0, sms_enqueued: 0 });
    NOW = new Date("2026-09-20T05:00:00.000Z");
    db.attendanceHoliday.push({ id: 1, madrasaId: 10, date: new Date("2026-09-20T00:00:00Z"), title: "x" });
    expect(await jobs.runAutoAbsent()).toEqual({ madrasas: 0, marked: 0, sms_enqueued: 0 });
    expect(db.attendance).toHaveLength(0);
  });
});

/* ================= offline alert job ================= */

describe("offline alert job", () => {
  it("queues one SMS per outage to the alert phone and re-arms on an online heartbeat", async () => {
    setRules({ offlineAlertEnabled: true, offlineAlertMinutes: 15, alertPhone: "01811111111" });
    db.attendanceDevice[0].lastSeenAt = new Date(NOW.getTime() - 20 * 60_000);

    expect(await jobs.runOfflineAlerts()).toEqual({ alerted: 1 });
    expect(db.smsQueue[0]).toMatchObject({ recipient: "01811111111", source: "device_alert" });
    expect(db.smsQueue[0].message).toBe("উপস্থিতি ডিভাইস 'Gate' 20 মিনিট ধরে অফলাইন। কানেক্টর PC ও ইন্টারনেট পরীক্ষা করুন।");
    expect(await jobs.runOfflineAlerts()).toEqual({ alerted: 0 });

    await ingest.heartbeat(db.attendanceDevice[0] as any, { device_id: "k40-a", device_status: "online" });
    expect(db.attendanceDevice[0].offlineAlertedAt).toBeNull();
  });
});
