import { describe, expect, it } from "vitest";
import { computeGpa, gradeForGpa, type GpaSubjectMark, type PointBand } from "../gpa";

const BANDS: PointBand[] = [
  { name: "A+", minMark: 80, maxMark: 100, point: 5 },
  { name: "A", minMark: 70, maxMark: 79, point: 4 },
  { name: "A-", minMark: 60, maxMark: 69, point: 3.5 },
  { name: "B", minMark: 50, maxMark: 59, point: 3 },
  { name: "C", minMark: 40, maxMark: 49, point: 2 },
  { name: "D", minMark: 33, maxMark: 39, point: 1 },
];

const sub = (mark: number, extra: Partial<GpaSubjectMark> = {}): GpaSubjectMark => ({
  mark,
  fullMark: 100,
  passMark: null,
  isOptional: false,
  isAbsent: false,
  isExempted: false,
  ...extra,
});

describe("computeGpa", () => {
  it("averages compulsory grade points", () => {
    expect(computeGpa([sub(85), sub(75), sub(65)], BANDS, 33)).toEqual({ gpa: 4.17, failed: false });
  });

  it("fails the whole result when any compulsory subject fails", () => {
    expect(computeGpa([sub(95), sub(20)], BANDS, 33)).toEqual({ gpa: 0, failed: true });
    expect(computeGpa([sub(95), sub(90, { isAbsent: true })], BANDS, 33)).toEqual({ gpa: 0, failed: true });
  });

  it("adds only the optional subject's points above 2 and caps at 5", () => {
    // (4 + 4) + (5 - 2) = 11 / 2 = 5.5 -> capped 5
    expect(computeGpa([sub(75), sub(75), sub(90, { isOptional: true })], BANDS, 33).gpa).toBe(5);
    // optional below C adds nothing, and a failed optional never fails the student
    expect(computeGpa([sub(75), sub(10, { isOptional: true })], BANDS, 33)).toEqual({ gpa: 4, failed: false });
  });

  it("ignores exempted subjects and uses per-subject pass marks on scaled full marks", () => {
    const res = computeGpa([sub(40, { fullMark: 50, passMark: 17 }), sub(0, { isExempted: true })], BANDS, 33);
    expect(res).toEqual({ gpa: 5, failed: false });
  });
});

describe("gradeForGpa", () => {
  it("maps GPA to the highest reached band", () => {
    expect(gradeForGpa(5, BANDS)).toBe("A+");
    expect(gradeForGpa(4.99, BANDS)).toBe("A");
    expect(gradeForGpa(3.5, BANDS)).toBe("A-");
    expect(gradeForGpa(0.5, BANDS)).toBeNull();
  });
});
