import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/config/env", () => ({
  env: { attendanceTimezone: "Asia/Dhaka", deviceSecretEncKey: "ab".repeat(32), smsMaxAttempts: 5 },
}));
vi.mock("../../../shared/logger/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));

import { addCounts, isHm, markDateProblem, parseBool, sessionPercentage } from "../attendance-session.rules";

describe("markDateProblem", () => {
  const today = "2026-10-06";
  it("rejects future dates", () => {
    expect(markDateProblem("2026-10-07", today, 7)).toBe("future_date");
  });
  it("allows today and the edit window", () => {
    expect(markDateProblem(today, today, 7)).toBeNull();
    expect(markDateProblem("2026-09-29", today, 7)).toBeNull();
  });
  it("flags dates older than the window", () => {
    expect(markDateProblem("2026-09-28", today, 7)).toBe("outside_window");
    expect(markDateProblem("2026-10-05", today, 0)).toBe("outside_window");
  });
});

describe("parseBool / isHm", () => {
  it("parses common boolean spellings", () => {
    expect(parseBool(true)).toBe(true);
    expect(parseBool("1")).toBe(true);
    expect(parseBool("false")).toBe(false);
    expect(parseBool(0)).toBe(false);
    expect(parseBool(undefined)).toBeUndefined();
    expect(parseBool("maybe")).toBeUndefined();
  });
  it("validates HH:mm", () => {
    expect(isHm("05:30")).toBe(true);
    expect(isHm("23:59")).toBe(true);
    expect(isHm("24:00")).toBe(false);
    expect(isHm("5:30")).toBe(false);
  });
});

describe("sessionPercentage", () => {
  const policy = { lateToAbsentCount: 0, leaveMode: "excluded" as const };
  it("counts marked slots only", () => {
    expect(sessionPercentage({ PRESENT: 3, LATE: 1, ABSENT: 1, LEAVE: 0 }, policy)).toEqual({ total: 5, percentage: 80 });
  });
  it("applies the policy leave / late rules", () => {
    const c = { PRESENT: 2, LATE: 2, ABSENT: 0, LEAVE: 1 };
    expect(sessionPercentage(c, policy).percentage).toBe(100);
    expect(sessionPercentage(c, { lateToAbsentCount: 2, leaveMode: "absent" }).percentage).toBe(60);
  });
  it("is 0 with no marks", () => {
    expect(sessionPercentage({ PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0 }, policy)).toEqual({ total: 0, percentage: 0 });
  });
  it("adds counts", () => {
    expect(addCounts({ PRESENT: 1, LATE: 2, ABSENT: 3, LEAVE: 4 }, { PRESENT: 1, LATE: 1, ABSENT: 1, LEAVE: 1 })).toEqual({
      PRESENT: 2,
      LATE: 3,
      ABSENT: 4,
      LEAVE: 5,
    });
  });
});
