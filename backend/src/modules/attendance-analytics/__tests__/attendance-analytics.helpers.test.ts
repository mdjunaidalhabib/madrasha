import { describe, expect, it } from "vitest";
import {
  attendanceRate,
  averageCheckIn,
  bucketTrend,
  deductibleDays,
  minutesToHm,
  netAmount,
  perDaySalary,
  suggestedDeduction,
  totalsFor,
  workedMinutes,
} from "../attendance-analytics.helpers";

describe("attendanceRate", () => {
  it("uses marked rows as the denominator", () => {
    expect(attendanceRate(6, 2, 10, 40)).toBe(80);
  });
  it("falls back to the population when nothing is marked", () => {
    expect(attendanceRate(0, 0, 0, 40)).toBe(0);
  });
  it("is 0 for an empty population and rounds to one decimal", () => {
    expect(attendanceRate(0, 0, 0, 0)).toBe(0);
    expect(attendanceRate(1, 0, 3, 3)).toBe(33.3);
  });
});

describe("totalsFor", () => {
  it("counts statuses of the population only and derives unmarked", () => {
    const status = new Map<number, string>([
      [1, "PRESENT"],
      [2, "LATE"],
      [3, "ABSENT"],
      [4, "LEAVE"],
      [99, "PRESENT"], // not in the population (inactive) - ignored
    ]);
    expect(totalsFor([1, 2, 3, 4, 5, 6], status)).toEqual({
      total: 6,
      present: 1,
      late: 1,
      absent: 1,
      leave: 1,
      unmarked: 2,
      rate: 50,
    });
  });
});

describe("bucketTrend", () => {
  it("emits one point per date, flags off days and fills gaps with zeros", () => {
    const points = bucketTrend(
      ["2026-10-01", "2026-10-02", "2026-10-03"],
      new Set(["2026-10-02"]),
      [
        { date: "2026-10-01", status: "PRESENT", count: 8 },
        { date: "2026-10-01", status: "ABSENT", count: 2 },
        { date: "2026-10-03", status: "LATE", count: 5 },
        { date: "2026-09-30", status: "PRESENT", count: 7 }, // outside - ignored
      ],
      10,
    );
    expect(points).toEqual([
      { date: "2026-10-01", off: false, present: 8, late: 0, absent: 2, leave: 0, total: 10, rate: 80 },
      { date: "2026-10-02", off: true, present: 0, late: 0, absent: 0, leave: 0, total: 10, rate: 0 },
      { date: "2026-10-03", off: false, present: 0, late: 5, absent: 0, leave: 0, total: 10, rate: 100 },
    ]);
  });
});

describe("payroll math", () => {
  it("per-day salary = salary / working days", () => {
    expect(perDaySalary(26000, 26)).toBe(1000);
    expect(perDaySalary(10000, 3)).toBe(3333.33);
    expect(perDaySalary(null, 26)).toBe(0);
    expect(perDaySalary(10000, 0)).toBe(0);
  });

  it("deductible days follow the leave mode", () => {
    const s = { ABSENT: 2, LEAVE: 3, unmarked: 1, late_penalty: 1 };
    expect(deductibleDays(s, "excluded")).toBe(4);
    expect(deductibleDays(s, "present")).toBe(4);
    expect(deductibleDays(s, "absent")).toBe(7);
  });

  it("suggested deduction is capped at the salary and off when the policy disables it", () => {
    expect(suggestedDeduction(26000, 26, 3, true)).toBe(3000);
    expect(suggestedDeduction(10000, 3, 1, true)).toBe(3333.33);
    expect(suggestedDeduction(26000, 26, 40, true)).toBe(26000);
    expect(suggestedDeduction(26000, 26, 3, false)).toBe(0);
    expect(suggestedDeduction(null, 26, 3, true)).toBe(0);
  });

  it("net amount mirrors payroll generate (basic + allowances - deductions)", () => {
    expect(netAmount(20000, 1500, 3000)).toBe(18500);
    expect(netAmount(1000.1, 0.2, 0)).toBe(1000.3);
  });
});

describe("check-in / worked time", () => {
  it("sums worked minutes only for complete, ordered pairs", () => {
    expect(
      workedMinutes([
        { checkInAt: new Date("2026-10-01T02:00:00Z"), checkOutAt: new Date("2026-10-01T10:30:00Z") },
        { checkInAt: new Date("2026-10-02T02:00:00Z"), checkOutAt: null },
        { checkInAt: new Date("2026-10-03T05:00:00Z"), checkOutAt: new Date("2026-10-03T04:00:00Z") },
      ]),
    ).toBe(510);
  });

  it("averages local check-in time (Asia/Dhaka = UTC+6)", () => {
    expect(
      averageCheckIn([new Date("2026-10-01T02:00:00Z"), new Date("2026-10-02T02:30:00Z"), null], "Asia/Dhaka"),
    ).toBe("08:15");
    expect(averageCheckIn([], "Asia/Dhaka")).toBeNull();
  });

  it("formats minutes as HH:mm", () => {
    expect(minutesToHm(0)).toBe("00:00");
    expect(minutesToHm(605)).toBe("10:05");
  });
});
