import { describe, expect, it } from "vitest";
import { getSubjectResult } from "../../../../../packages/shared-ui/src/utils/subjectResult";

describe("subject result highlighting across reports", () => {
  it("highlights a failed subject even when the student's overall result passes", () => {
    const student = { status: "PASS", subjects: [{ mark: 19, pass_mark: 20 }, { mark: 90, pass_mark: 35 }] };
    expect(student.subjects.map((subject) => getSubjectResult(subject))).toEqual(["fail", "pass"]);
  });

  it("uses a subject override on a 50-mark subject before the class threshold", () => {
    expect(getSubjectResult({ mark: 20, pass_mark: 20 }, 35)).toBe("pass");
    expect(getSubjectResult({ mark: 19, pass_mark: 20 }, 35)).toBe("fail");
  });

  it("uses the class threshold when the subject has no override", () => {
    expect(getSubjectResult({ mark: 34, pass_mark: null }, 35)).toBe("fail");
    expect(getSubjectResult({ mark: 35 }, 35)).toBe("pass");
  });

  it("handles decimal and database string marks at the pass boundary", () => {
    expect(getSubjectResult({ mark: "19.99", pass_mark: "20" })).toBe("fail");
    expect(getSubjectResult({ mark: "20.00", pass_mark: "20" })).toBe("pass");
  });

  it("preserves zero as a mark and as an explicit pass threshold", () => {
    expect(getSubjectResult({ mark: 0, pass_mark: 20 })).toBe("fail");
    expect(getSubjectResult({ mark: 0, pass_mark: 0 }, 35)).toBe("pass");
  });

  it("keeps absence separate from failure and never turns missing marks into zero", () => {
    expect(getSubjectResult({ mark: 0, is_absent: true, pass_mark: 35 })).toBe("absent");
    for (const subject of [undefined, { mark: null }, { mark: "" }, { mark: "invalid" }, { mark: 20 }]) {
      expect(getSubjectResult(subject)).toBe("missing");
    }
  });
});
