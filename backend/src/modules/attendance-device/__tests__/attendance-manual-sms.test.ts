import { describe, expect, it, vi } from "vitest";
import { AttendanceManualSmsService } from "../attendance-manual-sms.service";

// 2026-09-20 11:00 Dhaka
const NOW = new Date("2026-09-20T05:00:00.000Z");

const person = (id: number, eligible = true) => ({ type: "STUDENT", id, eligible, nameBn: `S${id}` });

const setup = (manualSms: boolean) => {
  const enqueue = vi.fn().mockResolvedValue("enqueued");
  const findStudents = vi.fn(async (_m: number, ids: number[]) => ids.map((id) => person(id, id !== 3)));
  const service = new AttendanceManualSmsService(
    { getRules: async () => ({ manualSms }) } as any,
    { findStudents } as any,
    { smsContextLoader: () => async () => ({ template: "x" }), enqueueStudentSms: enqueue } as any,
    () => NOW,
  );
  return { service, enqueue, findStudents };
};

const change = (attendeeId: number, newStatus: string, attendeeType = "STUDENT") =>
  ({ attendanceId: attendeeId * 10, attendeeType, attendeeId, newStatus }) as any;

describe("manual-mark SMS", () => {
  it("does nothing while the setting is off", async () => {
    const { service, enqueue } = setup(false);
    expect(await service.notify(10, "2026-09-20", [change(1, "ABSENT")])).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("never sends for another day than today", async () => {
    const { service, enqueue, findStudents } = setup(true);
    expect(await service.notify(10, "2026-09-19", [change(1, "ABSENT")])).toBe(0);
    expect(findStudents).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("absent -> absent SMS, present/late -> arrived SMS; skips leave, teachers and ineligible students", async () => {
    const { service, enqueue } = setup(true);
    const queued = await service.notify(10, "2026-09-20", [
      change(1, "ABSENT"),
      change(2, "LATE"),
      change(3, "PRESENT"), // ineligible
      change(4, "LEAVE"),
      change(5, "ABSENT", "TEACHER"),
    ]);
    expect(queued).toBe(2);
    expect(enqueue.mock.calls.map((c) => [c[1], c[2].id, c[6]?.status ?? null])).toEqual([
      ["absent", 1, null],
      ["present", 2, "দেরিতে উপস্থিত"],
    ]);
  });

  it("never throws", async () => {
    const { service, findStudents } = setup(true);
    findStudents.mockRejectedValueOnce(new Error("db down"));
    await expect(service.notify(10, "2026-09-20", [change(1, "ABSENT")])).resolves.toBe(0);
  });
});
