import { describe, expect, it } from "vitest";
import {
  dateOnly,
  isValidDateString,
  localDateString,
  localDayRangeUtc,
  localTimeString,
  parseIsoWithOffset,
  tzOffsetMinutes,
} from "../time.util";

const TZ = "Asia/Dhaka";

describe("parseIsoWithOffset", () => {
  it("accepts Z and numeric offsets", () => {
    expect(parseIsoWithOffset("2026-09-20T08:15:00+06:00")?.toISOString()).toBe("2026-09-20T02:15:00.000Z");
    expect(parseIsoWithOffset("2026-09-20T02:15:00Z")?.toISOString()).toBe("2026-09-20T02:15:00.000Z");
    expect(parseIsoWithOffset("2026-09-20T08:15:00+0600")?.toISOString()).toBe("2026-09-20T02:15:00.000Z");
    expect(parseIsoWithOffset("2026-09-20 08:15:00.500+06:00")?.toISOString()).toBe("2026-09-20T02:15:00.500Z");
  });

  it("rejects naive / malformed timestamps", () => {
    expect(parseIsoWithOffset("2026-09-20T08:15:00")).toBeNull();
    expect(parseIsoWithOffset("garbage")).toBeNull();
    expect(parseIsoWithOffset(12345)).toBeNull();
    expect(parseIsoWithOffset("2026-13-40T08:15:00+06:00")).toBeNull();
  });
});

describe("madrasa-local day", () => {
  it("Dhaka is UTC+6", () => {
    expect(tzOffsetMinutes(TZ, new Date("2026-09-20T00:00:00Z"))).toBe(360);
  });

  it("a punch just after Dhaka midnight belongs to the NEW local day", () => {
    expect(localDateString(new Date("2026-09-19T18:30:00Z"), TZ)).toBe("2026-09-20");
    expect(localDateString(new Date("2026-09-19T17:59:00Z"), TZ)).toBe("2026-09-19");
  });

  it("formats time and computes the UTC bounds of the local day", () => {
    expect(localTimeString(new Date("2026-09-20T02:15:00Z"), TZ)).toBe("08:15 AM");
    const { start, end } = localDayRangeUtc("2026-09-20", TZ);
    expect(start.toISOString()).toBe("2026-09-19T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-20T18:00:00.000Z");
  });

  it("dateOnly matches the Attendance.date convention (UTC midnight)", () => {
    expect(dateOnly("2026-09-20").toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("validates date strings", () => {
    expect(isValidDateString("2026-09-20")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("20-09-2026")).toBe(false);
  });
});
