import { describe, expect, it } from "vitest";
import { buildDemoClassRoutines } from "../demo-class-routine";

describe("new institution demo class routine", () => {
  it("only schedules selected classes and subjects, with Friday off and no teacher assigned", () => {
    const books = new Map([[10, [{ subject: "Arabic" }, { subject: "Math" }]], [20, [{ subject: "English" }]]]);
    const rows = buildDemoClassRoutines(7, [10, 10, 30], books);
    expect(rows).toHaveLength(48);
    expect(new Set(rows.map((row) => row.dayOfWeek))).toEqual(new Set([6, 0, 1, 2, 3, 4]));
    expect(rows.every((row) => row.madrasaId === 7 && row.classId === 10 && row.teacherId === null)).toBe(true);
    expect(new Set(rows.map((row) => row.subject))).toEqual(new Set(["Arabic", "Math"]));
  });

  it("keeps periods within a school day, avoids overlaps and covers larger subject catalogs", () => {
    const subjects = Array.from({ length: 14 }, (_, i) => ({ subject: `Subject ${i}` }));
    const rows = buildDemoClassRoutines(1, [10], new Map([[10, subjects]]));
    expect(rows).toHaveLength(48);
    expect(new Set(rows.map((row) => row.subject)).size).toBe(14);
    for (const day of [6, 0, 1, 2, 3, 4]) {
      const periods = rows.filter((row) => row.dayOfWeek === day);
      expect(periods).toHaveLength(8);
      periods.forEach((row, i) => {
        expect(row.startTime < row.endTime && row.endTime <= "14:50").toBe(true);
        if (i) expect(periods[i - 1].endTime <= row.startTime).toBe(true);
      });
    }
  });

  it("handles empty selections and repeated subjects", () => {
    expect(buildDemoClassRoutines(1, [], new Map())).toEqual([]);
    expect(buildDemoClassRoutines(1, [10], new Map())).toEqual([]);
    expect(buildDemoClassRoutines(1, [10], new Map([[10, [{ subject: "Arabic" }, { subject: "Arabic" }]]]))).toHaveLength(48);
  });
});
