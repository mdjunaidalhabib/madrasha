import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/config/env", () => ({
  env: { attendanceTimezone: "Asia/Dhaka", smsMaxAttempts: 5 },
}));
vi.mock("../../../shared/logger/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../attendance/core/attendance-audit", () => ({
  recordAttendanceChanges: vi.fn(async (_db: unknown, rows: unknown[]) => rows.length),
}));

import { recordAttendanceChanges } from "../../attendance/core/attendance-audit";
import { DEFAULT_NOTIFICATION_TEMPLATES } from "../../notifications/notification.constants";
import { AttendanceAlertsService } from "../attendance-alerts.service";
import { AttendanceLeaveService } from "../attendance-leave.service";
import {
  absenceStreak,
  calendarDays,
  checkLeaveRange,
  ExistingRow,
  planLeaveApproval,
  planLeaveRemoval,
  shouldAlert,
} from "../attendance-leave.rules";

const row = (id: number, date: string, status: ExistingRow["status"], source = "manual"): ExistingRow => ({
  id,
  date,
  status,
  source,
});

beforeEach(() => vi.clearAllMocks());

/* ================= pure rules ================= */

describe("planLeaveApproval", () => {
  it("creates LEAVE on empty working days, converts ABSENT (any source), leaves PRESENT/LATE/LEAVE alone", () => {
    const plan = planLeaveApproval(
      ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"],
      [
        row(1, "2026-10-05", "ABSENT", "auto"),
        row(2, "2026-10-06", "PRESENT", "k40"),
        row(3, "2026-10-07", "LATE"),
        row(4, "2026-10-08", "LEAVE"),
        // Off day (not in workingDays): ignored even when absent.
        row(5, "2026-10-09", "ABSENT"),
      ],
    );
    expect(plan.create).toEqual(["2026-10-04"]);
    expect(plan.convert.map((r) => r.id)).toEqual([1]);
    expect(plan.skipped.map((r) => r.id)).toEqual([2, 3, 4]);
  });

  it("only working days get LEAVE", () => {
    expect(planLeaveApproval([], []).create).toEqual([]);
    expect(planLeaveApproval(["2026-10-06"], []).create).toEqual(["2026-10-06"]);
  });
});

describe("planLeaveRemoval", () => {
  it("removes only LEAVE rows with source 'leave' inside the range", () => {
    const rows = [
      row(1, "2026-10-05", "LEAVE", "leave"),
      row(2, "2026-10-06", "LEAVE", "manual"),
      row(3, "2026-10-07", "PRESENT", "leave"),
      row(4, "2026-10-10", "LEAVE", "leave"),
    ];
    expect(planLeaveRemoval(rows, "2026-10-05", "2026-10-08").map((r) => r.id)).toEqual([1]);
  });
});

describe("checkLeaveRange", () => {
  it("validates order, length and earliest start", () => {
    expect(calendarDays("2026-10-01", "2026-10-30")).toBe(30);
    expect(checkLeaveRange("2026-10-02", "2026-10-01", 30, null)).toBe("from_after_to");
    expect(checkLeaveRange("2026-10-01", "2026-10-30", 30, null)).toBeNull();
    expect(checkLeaveRange("2026-10-01", "2026-10-31", 30, null)).toBe("too_long");
    expect(checkLeaveRange("2026-10-02", "2026-10-03", 30, "2026-10-03")).toBe("too_early");
    expect(checkLeaveRange("2026-10-03", "2026-10-03", 30, "2026-10-03")).toBeNull();
  });
});

describe("absenceStreak / shouldAlert", () => {
  const taken = ["2026-10-06", "2026-10-05", "2026-10-04", "2026-10-01"];

  it("counts consecutive ABSENT taken days from the newest", () => {
    const s = absenceStreak(
      taken,
      new Map([
        ["2026-10-06", "ABSENT"],
        ["2026-10-05", "ABSENT"],
        ["2026-10-04", "ABSENT"],
        ["2026-10-01", "PRESENT"],
      ] as const),
    );
    expect(s).toEqual({ streak: 3, since: "2026-10-04" });
  });

  it("LEAVE, LATE or an unmarked day breaks the streak", () => {
    expect(absenceStreak(taken, new Map([["2026-10-06", "LEAVE"]] as const)).streak).toBe(0);
    expect(
      absenceStreak(taken, new Map([["2026-10-06", "ABSENT"], ["2026-10-04", "ABSENT"]] as const)),
    ).toEqual({ streak: 1, since: "2026-10-06" });
    expect(absenceStreak(taken, new Map()).since).toBeNull();
  });

  it("alerts once per streak", () => {
    const s = { streak: 3, since: "2026-10-04" };
    expect(shouldAlert(s, 3, null)).toBe(true);
    expect(shouldAlert(s, 4, null)).toBe(false);
    expect(shouldAlert(s, 3, "2026-10-05")).toBe(false);
    expect(shouldAlert(s, 3, "2026-10-01")).toBe(true);
    expect(shouldAlert(s, 0, null)).toBe(false);
  });
});

/* ================= leave service (fake repository) ================= */

const makeLeaveRepo = (attendance: ExistingRow[], status = "PENDING") => {
  const request = {
    id: 7,
    madrasaId: 1,
    attendeeType: "STUDENT",
    attendeeId: 42,
    fromDate: new Date("2026-10-04T00:00:00Z"),
    toDate: new Date("2026-10-08T00:00:00Z"),
    leaveType: "sick",
    reason: "fever",
    status,
    requestedVia: "admin",
    requestedById: 9,
    guardianId: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: new Date("2026-10-03T10:00:00Z"),
    updatedAt: new Date("2026-10-03T10:00:00Z"),
  };
  const repo: any = {
    transaction: vi.fn(async (fn: any) => fn("TX")),
    findById: vi.fn(async () => request),
    transition: vi.fn(async (_tx: any, _m: number, _id: number, from: string[], data: any) => {
      if (!from.includes(request.status)) return { count: 0 };
      Object.assign(request, data);
      return { count: 1 };
    }),
    findAttendanceInRange: vi.fn(async () =>
      attendance.map((r) => ({ id: r.id, date: new Date(`${r.date}T00:00:00Z`), status: r.status, source: r.source })),
    ),
    createAttendances: vi.fn(async (_tx: any, data: any[]) => data.map((d, i) => ({ id: 100 + i, date: d.date }))),
    updateAttendanceStatus: vi.fn(async (_tx: any, ids: number[]) => ({ count: ids.length })),
    deleteAttendances: vi.fn(async (_tx: any, _m: number, ids: number[]) => ({ count: ids.length })),
    findPeople: vi.fn(async () => [{ type: "STUDENT", id: 42, nameBn: "আব্দুল্লাহ", classId: 3, className: "হিফজ", roll: 5 }]),
    findUserNames: vi.fn(async () => new Map([[9, "Admin"]])),
    findGuardianNames: vi.fn(async () => new Map()),
    findOverlap: vi.fn(async () => null),
  };
  return { repo, request };
};

const calendar: any = {
  // 2026-10-09 (Friday) is off.
  range: vi.fn(async () => ({
    workingDays: ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"],
    offDays: [],
  })),
};

describe("AttendanceLeaveService.approve", () => {
  it("marks working days in one transaction and audits creates + conversions via 'leave'", async () => {
    const { repo, request } = makeLeaveRepo([row(1, "2026-10-05", "ABSENT", "auto"), row(2, "2026-10-06", "PRESENT", "k40")]);
    const svc = new AttendanceLeaveService(repo, calendar);
    const res = await svc.approve(1, 7, 9, "ok");

    expect(request.status).toBe("APPROVED");
    expect(res.days_marked).toBe(4);
    expect(res.days_skipped).toBe(1);
    expect(res.request).toMatchObject({ id: 7, attendee_name: "আব্দুল্লাহ", class_name: "হিফজ", roll: 5, days: 5 });

    const created = repo.createAttendances.mock.calls[0][1];
    expect(created.map((d: any) => d.date.toISOString().slice(0, 10))).toEqual(["2026-10-04", "2026-10-07", "2026-10-08"]);
    expect(created[0]).toMatchObject({ status: "LEAVE", source: "leave", classId: 3, attendeeId: 42 });
    expect(repo.updateAttendanceStatus).toHaveBeenCalledWith("TX", [1], expect.objectContaining({ status: "LEAVE", source: "leave" }));

    const audits = (recordAttendanceChanges as any).mock.calls[0][1];
    expect(audits).toHaveLength(4);
    expect(audits.every((a: any) => a.via === "leave" && a.newStatus === "LEAVE" && a.newSource === "leave")).toBe(true);
    expect(audits.find((a: any) => a.attendanceId === 1)).toMatchObject({ oldStatus: "ABSENT", oldSource: "auto" });
  });

  it("refuses a request that is not pending", async () => {
    const { repo } = makeLeaveRepo([], "REJECTED");
    await expect(new AttendanceLeaveService(repo, calendar).approve(1, 7, 9)).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.transaction).not.toHaveBeenCalled();
  });
});

describe("AttendanceLeaveService.cancel", () => {
  it("cancelling an approved leave deletes only its own LEAVE rows, audited via leave_cancel", async () => {
    const { repo, request } = makeLeaveRepo(
      [row(1, "2026-10-05", "LEAVE", "leave"), row(2, "2026-10-06", "LEAVE", "manual"), row(3, "2026-10-07", "PRESENT", "k40")],
      "APPROVED",
    );
    await new AttendanceLeaveService(repo, calendar).cancel(1, 7, 9, "came back");
    expect(request.status).toBe("CANCELLED");
    expect(repo.deleteAttendances).toHaveBeenCalledWith("TX", 1, [1]);
    const audits = (recordAttendanceChanges as any).mock.calls[0][1];
    expect(audits).toEqual([
      expect.objectContaining({ attendanceId: 1, oldStatus: "LEAVE", newStatus: null, newSource: null, via: "leave_cancel" }),
    ]);
  });

  it("cancelling a pending request touches no attendance", async () => {
    const { repo, request } = makeLeaveRepo([row(1, "2026-10-05", "LEAVE", "leave")]);
    await new AttendanceLeaveService(repo, calendar).cancel(1, 7, 9);
    expect(request.status).toBe("CANCELLED");
    expect(repo.deleteAttendances).not.toHaveBeenCalled();
  });

  it("guardian cancel: only own child's guardian-submitted pending request", async () => {
    const { repo } = makeLeaveRepo([]);
    const svc = new AttendanceLeaveService(repo, calendar);
    await expect(svc.cancelForGuardian(1, 5, [41], 7)).rejects.toMatchObject({ statusCode: 404 });
    await expect(svc.cancelForGuardian(1, 5, [42], 7)).rejects.toMatchObject({ statusCode: 403 });
  });
});

/* ================= consecutive-absence job ================= */

describe("AttendanceAlertsService.alertsForMadrasa", () => {
  // 2026-10-06 12:30 Dhaka (06:30Z).
  const NOW = new Date("2026-10-06T06:30:00.000Z");
  const working = ["2026-10-01", "2026-10-04", "2026-10-05", "2026-10-06"];
  const policyRow: any = { madrasaId: 1, consecutiveAbsentDays: 3, lastConsecutiveCheck: null };

  const setup = (lastAlert: string | null = null) => {
    const repo: any = {
      findStudentsAbsentOnAll: vi.fn(async () => [42]),
      findEligibleStudents: vi.fn(async () => [
        { type: "STUDENT", id: 42, nameBn: "আব্দুল্লাহ", className: "হিফজ", roll: 5, guardianPhone: "01700000000" },
      ]),
      findStudentRows: vi.fn(async () =>
        ["2026-10-04", "2026-10-05", "2026-10-06"].map((d, i) => ({
          id: 10 + i,
          attendeeId: 42,
          date: new Date(`${d}T00:00:00Z`),
          status: "ABSENT",
        })),
      ),
      lastAlertDates: vi.fn(async () => (lastAlert ? new Map([[42, lastAlert]]) : new Map())),
    };
    const policyRepo: any = { setLastConsecutiveCheck: vi.fn(async () => ({ count: 1 })) };
    const cal: any = {
      range: vi.fn(async () => ({ workingDays: working, offDays: [] })),
      offDay: vi.fn(async () => null),
    };
    const deviceSettings: any = { getRules: vi.fn(async () => ({ autoAbsentEnabled: false, absentCutoffTime: "10:30" })) };
    const sms: any = { enqueueSms: vi.fn(async () => ({ count: 1 })) };
    const notifications: any = {
      findMasterEnabled: vi.fn(async () => true),
      findSetting: vi.fn(async () => ({ isEnabled: 1, template: DEFAULT_NOTIFICATION_TEMPLATES.ATTENDANCE_CONSECUTIVE_ABSENT })),
    };
    const taken = vi.fn(async () => new Set(working));
    const svc = new AttendanceAlertsService(repo, policyRepo, cal, deviceSettings, sms, notifications, () => NOW, taken as any);
    return { svc, repo, policyRepo, sms, notifications };
  };

  it("queues one guardian SMS for a 3-day streak and marks the day done", async () => {
    const { svc, sms, policyRepo, repo } = setup();
    expect(await svc.alertsForMadrasa(policyRow)).toBe(1);
    expect(repo.findStudentsAbsentOnAll).toHaveBeenCalledWith(1, ["2026-10-06", "2026-10-05", "2026-10-04"], undefined);
    const data = sms.enqueueSms.mock.calls[0][0];
    expect(data).toMatchObject({
      dedupeKey: "consec:1:42:2026-10-06",
      recipient: "01700000000",
      source: "attendance_consecutive",
      studentId: 42,
      attendanceId: 12,
    });
    expect(data.message).toContain("আব্দুল্লাহ");
    expect(data.message).toContain("3");
    expect(policyRepo.setLastConsecutiveCheck).toHaveBeenCalledWith(1, new Date("2026-10-06T00:00:00Z"));
  });

  it("does not alert again for the same streak", async () => {
    const { svc, sms } = setup("2026-10-05");
    expect(await svc.alertsForMadrasa(policyRow)).toBe(0);
    expect(sms.enqueueSms).not.toHaveBeenCalled();
  });

  it("is idempotent per day and waits for the run time", async () => {
    const { svc, sms } = setup();
    expect(await svc.alertsForMadrasa({ ...policyRow, lastConsecutiveCheck: new Date("2026-10-06T00:00:00Z") })).toBeNull();
    const early = new AttendanceAlertsService(
      {} as any,
      {} as any,
      {} as any,
      { getRules: vi.fn(async () => ({ autoAbsentEnabled: false })) } as any,
      sms,
      {} as any,
      () => new Date("2026-10-06T04:00:00.000Z"), // 10:00 Dhaka < 12:00
    );
    expect(await early.alertsForMadrasa(policyRow)).toBeNull();
    expect(sms.enqueueSms).not.toHaveBeenCalled();
  });

  it("opt-in event: nothing queued while disabled, but the day is still marked done", async () => {
    const { svc, sms, notifications, policyRepo } = setup();
    notifications.findSetting.mockResolvedValue(null);
    expect(await svc.alertsForMadrasa(policyRow)).toBe(0);
    expect(sms.enqueueSms).not.toHaveBeenCalled();
    expect(policyRepo.setLastConsecutiveCheck).toHaveBeenCalled();
  });
});
