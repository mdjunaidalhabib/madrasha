import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/config/env", () => ({ env: { attendanceTimezone: "Asia/Dhaka" } }));
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));

import {
  assertMarkDateAllowed,
  BulkEntryInput,
  classifyMarkDate,
  correctionNeedsEdit,
  ExistingRow,
  MarkRuleViolation,
  parsePolicyInput,
  planBulkMark,
} from "../attendance.rules";
import { computeStats } from "../core/attendance-stats";

const TODAY = "2026-10-06";

const entry = (attendeeId: number, status: BulkEntryInput["status"], remarks: string | null = null): BulkEntryInput => ({
  attendeeId,
  status,
  remarks,
});
const row = (attendeeId: number, status: ExistingRow["status"], source = "manual", remarks: string | null = null): ExistingRow => ({
  id: attendeeId * 10,
  attendeeId,
  status,
  source,
  remarks,
});
const opts = { isPast: false, canEdit: false, overrideProtected: false, reason: null as string | null };

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof MarkRuleViolation ? e.code : "other";
  }
  return null;
};

describe("classifyMarkDate / assertMarkDateAllowed", () => {
  it("classifies relative to today and the edit window", () => {
    expect(classifyMarkDate("2026-10-07", TODAY, 7)).toBe("future");
    expect(classifyMarkDate(TODAY, TODAY, 7)).toBe("today");
    expect(classifyMarkDate("2026-09-29", TODAY, 7)).toBe("within_window");
    expect(classifyMarkDate("2026-09-28", TODAY, 7)).toBe("outside_window");
    expect(classifyMarkDate("2026-10-05", TODAY, 0)).toBe("outside_window");
  });

  it("rejects future dates always and old dates without attendance.edit", () => {
    expect(code(() => assertMarkDateAllowed("future", true))).toBe("future_date");
    expect(code(() => assertMarkDateAllowed("outside_window", false))).toBe("edit_permission_required");
    expect(code(() => assertMarkDateAllowed("outside_window", true))).toBeNull();
    expect(code(() => assertMarkDateAllowed("within_window", false))).toBeNull();
  });

  it("corrections of device/leave rows or old rows need attendance.edit", () => {
    expect(correctionNeedsEdit("today", "manual")).toBe(false);
    expect(correctionNeedsEdit("today", "auto")).toBe(false);
    expect(correctionNeedsEdit("today", "k40")).toBe(true);
    expect(correctionNeedsEdit("within_window", "leave")).toBe(true);
    expect(correctionNeedsEdit("outside_window", "manual")).toBe(true);
  });
});

describe("planBulkMark", () => {
  it("creates new rows, leaves unchanged rows alone and updates changed ones", () => {
    const plan = planBulkMark(
      [entry(1, "PRESENT"), entry(2, "ABSENT"), entry(3, "LATE")],
      [row(2, "ABSENT"), row(3, "PRESENT", "auto")],
      opts,
    );
    expect(plan.creates.map((e) => e.attendeeId)).toEqual([1]);
    expect(plan.unchanged).toBe(1);
    expect(plan.updates.map((u) => [u.entry.attendeeId, u.existing.status])).toEqual([[3, "PRESENT"]]);
    expect(plan.skipped).toEqual([]);
  });

  it("skips protected device/leave rows unless override + edit + reason", () => {
    const entries = [entry(1, "ABSENT"), entry(2, "PRESENT")];
    const existing = [row(1, "PRESENT", "k40"), row(2, "LEAVE", "leave")];
    expect(planBulkMark(entries, existing, opts).skipped).toEqual([
      { attendee_id: 1, source: "k40" },
      { attendee_id: 2, source: "leave" },
    ]);
    expect(planBulkMark(entries, existing, { ...opts, overrideProtected: true, canEdit: true }).skipped).toHaveLength(2);
    expect(planBulkMark(entries, existing, { ...opts, overrideProtected: true, reason: "x" }).skipped).toHaveLength(2);
    const ok = planBulkMark(entries, existing, { ...opts, overrideProtected: true, canEdit: true, reason: "device error" });
    expect(ok.skipped).toEqual([]);
    expect(ok.updates).toHaveLength(2);
  });

  it("requires a reason to change a past row, but not to create one", () => {
    expect(code(() => planBulkMark([entry(1, "ABSENT")], [row(1, "PRESENT")], { ...opts, isPast: true }))).toBe("reason_required");
    expect(code(() => planBulkMark([entry(1, "ABSENT")], [], { ...opts, isPast: true }))).toBeNull();
    expect(code(() => planBulkMark([entry(1, "PRESENT")], [row(1, "PRESENT")], { ...opts, isPast: true }))).toBeNull();
    // A skipped protected row does not demand a reason.
    expect(code(() => planBulkMark([entry(1, "ABSENT")], [row(1, "PRESENT", "k40")], { ...opts, isPast: true }))).toBeNull();
    expect(planBulkMark([entry(1, "ABSENT")], [row(1, "PRESENT")], { ...opts, isPast: true, reason: "typo" }).updates).toHaveLength(1);
  });

  it("writes remark-only edits without touching device rows; last duplicate wins", () => {
    const plan = planBulkMark(
      [entry(1, "PRESENT", "note"), entry(2, "PRESENT", "note"), entry(3, "ABSENT"), entry(3, "LATE")],
      [row(1, "PRESENT"), row(2, "PRESENT", "k40")],
      opts,
    );
    expect(plan.remarkUpdates.map((u) => u.entry.attendeeId)).toEqual([1]);
    expect(plan.unchanged).toBe(1);
    expect(plan.creates).toEqual([entry(3, "LATE")]);
  });
});

describe("parsePolicyInput", () => {
  it("accepts a valid partial body", () => {
    const res = parsePolicyInput({ edit_window_days: "3", leave_mode: "present", payroll_deduct_absent: false, consecutive_absent_days: 0 });
    expect(res).toEqual({ ok: true, patch: { editWindowDays: 3, leaveMode: "present", payrollDeductAbsent: false, consecutiveAbsentDays: 0 } });
  });

  it("rejects out-of-range values", () => {
    const field = (body: object) => {
      const r = parsePolicyInput(body);
      return r.ok ? null : r.error.field;
    };
    expect(field({ edit_window_days: 366 })).toBe("edit_window_days");
    expect(field({ edit_window_days: 1.5 })).toBe("edit_window_days");
    expect(field({ late_to_absent_count: 32 })).toBe("late_to_absent_count");
    expect(field({ leave_mode: "half" })).toBe("leave_mode");
    expect(field({ low_attendance_percent: -1 })).toBe("low_attendance_percent");
    expect(field({ consecutive_absent_days: 1 })).toBe("consecutive_absent_days");
    expect(field({ consecutive_absent_days: 31 })).toBe("consecutive_absent_days");
    expect(field({ payroll_deduct_absent: "maybe" })).toBe("payroll_deduct_absent");
  });
});

describe("computeStats", () => {
  const policy = { lateToAbsentCount: 0, leaveMode: "excluded" as const };

  it("counts unmarked taken working days as absent", () => {
    const s = computeStats({ PRESENT: 15, LATE: 0, ABSENT: 2, LEAVE: 0 }, 20, policy);
    expect(s.unmarked).toBe(3);
    expect(s.counted_days).toBe(20);
    expect(s.percentage).toBe(75);
  });

  it("applies the leave mode", () => {
    const counts = { PRESENT: 8, LATE: 0, ABSENT: 0, LEAVE: 2 };
    expect(computeStats(counts, 10, policy).percentage).toBe(100);
    expect(computeStats(counts, 10, { ...policy, leaveMode: "present" }).percentage).toBe(100);
    expect(computeStats(counts, 10, { ...policy, leaveMode: "absent" }).percentage).toBe(80);
  });

  it("turns every N late days into one absent", () => {
    const s = computeStats({ PRESENT: 4, LATE: 6, ABSENT: 0, LEAVE: 0 }, 10, { ...policy, lateToAbsentCount: 3 });
    expect(s.late_penalty).toBe(2);
    expect(s.attended).toBe(8);
    expect(s.percentage).toBe(80);
  });

  it("is 0 with no counted days", () => {
    expect(computeStats({ PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0 }, 0, policy).percentage).toBe(0);
  });
});
