import { describe, expect, it } from "vitest";
import { timeRangesOverlap } from "../time-range.util";

describe("timeRangesOverlap", () => {
  it("detects a clear overlap", () => {
    expect(timeRangesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
  });

  it("detects one range fully inside another", () => {
    expect(timeRangesOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
  });

  it("treats back-to-back ranges as non-overlapping", () => {
    expect(timeRangesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });

  it("treats clearly separate ranges as non-overlapping", () => {
    expect(timeRangesOverlap("09:00", "10:00", "11:00", "12:00")).toBe(false);
  });

  it("is symmetric regardless of argument order", () => {
    expect(timeRangesOverlap("14:00", "15:00", "09:00", "10:00")).toBe(false);
    expect(timeRangesOverlap("09:30", "10:30", "09:00", "10:00")).toBe(true);
  });
});
