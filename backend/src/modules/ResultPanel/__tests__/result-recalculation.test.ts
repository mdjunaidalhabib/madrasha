import { beforeEach, describe, expect, it, vi } from "vitest";

// The engine under test only talks to its injected repository; everything
// that would otherwise open a DB connection at import time is stubbed.
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn(async () => undefined) }));
vi.mock("../../../shared/utils/rbac.util", () => ({
  hasFullMarksAuthority: vi.fn(),
  hasFullResultAuthority: vi.fn(),
  hasExamDepartmentAuthority: vi.fn(),
}));
vi.mock("../../notifications/notification.service", () => ({ notificationService: {} }));
vi.mock("../result-workflow.service", () => ({ resultWorkflowService: {} }));

import { logActivity } from "../../../shared/utils/activity.util";
import { ResultPanelService } from "../result-panel.service";

type Status = "DRAFT" | "PROCESSING" | "RESULT_VERIFIED" | "APPROVED" | "PUBLISHED" | "LOCKED";

interface StoredRow {
  studentId: number;
  total: number;
  average: number;
  generalGrade: string | null;
  madrasaGrade: string | null;
  status: string | null;
  rankNo: number | null;
  roll: number | null;
}

const GENERAL_GRADES = [
  { name: "A+", minMark: 80, maxMark: 100 },
  { name: "B", minMark: 50, maxMark: 79 },
  { name: "D", minMark: 30, maxMark: 49 },
];
const MADRASA_GRADES = [
  { name: "মুমতায", minMark: 80, maxMark: 100 },
  { name: "জায়্যিদ", minMark: 50, maxMark: 79 },
  { name: "মাকবুল", minMark: 30, maxMark: 49 },
];

/** One 100-mark subject, three students (averages 90 / 40 / 34). */
function buildScenario(opts: {
  failMark: number;
  status: Status;
  stored: StoredRow[];
  currentRolls?: Record<number, number>;
  incomplete?: boolean;
}) {
  const marksByStudent: Record<number, number> = { 1: 90, 2: 40, 3: 34 };
  const replaced: { summary: any[]; masterData: any }[] = [];
  const snapshots: { reason: string; createdBy: number | null }[] = [];

  const repository = {
    findSettings: async () => [{ name: "fail_mark", value: String(opts.failMark) }],
    findGeneralGrades: async () => GENERAL_GRADES,
    findMadrasaGrades: async () => MADRASA_GRADES,
    findClassGradingScope: async () => ({ divisionId: null, divisionFailMark: null }),
    findResultMasterById: async (id: number) => ({ id, examId: 10, classId: 20, status: opts.status }),
    findProcessedMasters: async (_madrasaId: number, only?: number) => {
      if (only && only !== 100) return [];
      return [
        {
          id: 100,
          examId: 10,
          classId: 20,
          status: opts.status,
          exam: { name: "বার্ষিক" },
          class: { nameBn: "পঞ্চম", name: "Five" },
        },
      ];
    },
    findActiveSubjectsForClass: async () => [
      { book: { id: 5 }, fullMark: 100, isMiyari: false, passMark: null },
    ],
    findRequiredStudentsInClass: async () =>
      [1, 2, 3].map((id) => ({ id, nameBn: `শিক্ষার্থী ${id}`, roll: id })),
    groupMarksByStudent: async () =>
      Object.entries(marksByStudent)
        .filter(([id]) => !(opts.incomplete && id === "3"))
        .map(([id, mark]) => ({ studentId: Number(id), _sum: { mark }, _count: { _all: 1 } })),
    countAbsentMarksByStudent: async () => [],
    findExemptedMarksByStudent: async () => [],
    findWithheldStudentIds: async () => [],
    findStudentsFailingMiyariSubjects: async () => [],
    findRollsByStudentIds: async (ids: number[]) =>
      ids.map((id) => ({ id, roll: opts.currentRolls?.[id] ?? id })),
    findResultSummaryForDiff: async () => opts.stored,
    replaceResultSummaryInTransaction: async (_id: number, summary: any[], masterData: any) => {
      replaced.push({ summary, masterData });
    },
    createResultSnapshot: async (_m: number, _r: number, _json: string, reason: string, createdBy: number | null) => {
      snapshots.push({ reason, createdBy });
    },
  };

  const service = new ResultPanelService(repository as any);
  vi.spyOn(service, "getFullResultView").mockResolvedValue({} as any);

  return { service, replaced, snapshots };
}

// What a 33-mark fail line produced: everyone passes, incl. the 34 student.
const storedUnderFail33 = (): StoredRow[] => [
  { studentId: 1, total: 90, average: 90, generalGrade: "A+", madrasaGrade: "মুমতায", status: "PASS", rankNo: 1, roll: 1 },
  { studentId: 2, total: 40, average: 40, generalGrade: "D", madrasaGrade: "মাকবুল", status: "PASS", rankNo: 2, roll: 2 },
  { studentId: 3, total: 34, average: 34, generalGrade: "D", madrasaGrade: "মাকবুল", status: "PASS", rankNo: 3, roll: 3 },
];

describe("ResultPanelService.recalculateResults", () => {
  beforeEach(() => {
    vi.mocked(logActivity).mockClear();
  });

  it("re-grades a PROCESSING result in place when the fail mark rose", async () => {
    const { service, replaced, snapshots } = buildScenario({
      failMark: 35,
      status: "PROCESSING",
      stored: storedUnderFail33(),
    });

    const out = await service.recalculateResults(1, 7, {});

    expect(out.totals.updated).toBe(1);
    expect(out.results[0].outcome).toBe("UPDATED");
    expect(out.results[0].changed_students).toBe(1); // only the 34-average student flips
    const student3 = replaced[0].summary.find((r) => r.studentId === 3);
    expect(student3.status).toBe("FAIL");
    expect(replaced[0].masterData.status).toBeUndefined(); // stays PROCESSING
    expect(snapshots).toHaveLength(0); // unpublished: no audit snapshot needed
    expect(logActivity).toHaveBeenCalledTimes(1);
  });

  it("steps an APPROVED result back to PROCESSING and clears the sign-off", async () => {
    const { service, replaced } = buildScenario({
      failMark: 35,
      status: "APPROVED",
      stored: storedUnderFail33(),
    });

    await service.recalculateResults(1, 7, {});

    expect(replaced[0].masterData).toMatchObject({
      status: "PROCESSING",
      resultVerifiedBy: null,
      approvedBy: null,
    });
  });

  it("leaves a PUBLISHED result alone by default and only reports it as pending", async () => {
    const { service, replaced, snapshots } = buildScenario({
      failMark: 35,
      status: "PUBLISHED",
      stored: storedUnderFail33(),
    });

    const out = await service.recalculateResults(1, 7, { includePublished: false });

    expect(replaced).toHaveLength(0);
    expect(snapshots).toHaveLength(0);
    expect(out.results[0].outcome).toBe("WOULD_UPDATE");
    expect(out.totals.pending_published).toBe(1);
    expect(out.totals.updated).toBe(0);
  });

  it("applies to a PUBLISHED result when asked, keeping its status and writing an audit snapshot", async () => {
    const { service, replaced, snapshots } = buildScenario({
      failMark: 35,
      status: "PUBLISHED",
      stored: storedUnderFail33(),
    });

    const out = await service.recalculateResults(1, 7, { includePublished: true });

    expect(out.totals.updated).toBe(1);
    expect(replaced[0].masterData).toEqual({ status: "PUBLISHED" });
    expect(snapshots).toEqual([{ reason: "RECALCULATE", createdBy: 7 }]);
  });

  it("treats a single-session call as an explicit act, so it includes published", async () => {
    const { service, replaced } = buildScenario({
      failMark: 35,
      status: "LOCKED",
      stored: storedUnderFail33(),
    });

    const out = await service.recalculateResults(1, 7, { resultMasterId: 100 });

    expect(out.include_published).toBe(true);
    expect(replaced).toHaveLength(1);
    expect(replaced[0].masterData).toEqual({ status: "LOCKED" });
  });

  it("writes nothing on a dry run, even for unpublished sessions", async () => {
    const { service, replaced } = buildScenario({
      failMark: 35,
      status: "PROCESSING",
      stored: storedUnderFail33(),
    });

    const out = await service.recalculateResults(1, 7, { dryRun: true });

    expect(replaced).toHaveLength(0);
    expect(out.results[0].outcome).toBe("WOULD_UPDATE");
    expect(out.totals.pending_unpublished).toBe(1);
  });

  it("does nothing when the stored result already matches the current config", async () => {
    const { service, replaced, snapshots } = buildScenario({
      failMark: 33,
      status: "PUBLISHED",
      stored: storedUnderFail33(),
    });

    const out = await service.recalculateResults(1, 7, { includePublished: true });

    expect(out.results[0].outcome).toBe("UNCHANGED");
    expect(replaced).toHaveLength(0);
    expect(snapshots).toHaveLength(0);
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("keeps each student's original roll snapshot instead of today's roll", async () => {
    const { service, replaced } = buildScenario({
      failMark: 35,
      status: "PROCESSING",
      stored: storedUnderFail33().map((r) => ({ ...r, roll: r.studentId + 100 })),
      currentRolls: { 1: 1, 2: 2, 3: 3 }, // promoted since: rolls were overwritten
    });

    await service.recalculateResults(1, 7, {});

    expect(replaced[0].summary.map((r) => r.roll).sort()).toEqual([101, 102, 103]);
  });

  it("skips (never clears) a session whose marks are no longer complete", async () => {
    const { service, replaced } = buildScenario({
      failMark: 35,
      status: "PUBLISHED",
      stored: storedUnderFail33(),
      incomplete: true,
    });

    const out = await service.recalculateResults(1, 7, { includePublished: true });

    expect(out.results[0]).toMatchObject({ outcome: "SKIPPED", skip_reason: "INCOMPLETE_MARKS" });
    expect(replaced).toHaveLength(0);
  });

  it("reports NOT_FOUND-style errors for an unknown single session instead of silently succeeding", async () => {
    const { service } = buildScenario({ failMark: 35, status: "PROCESSING", stored: [] });
    (service as any).repository.findResultMasterById = async () => null;

    await expect(service.recalculateResults(1, 7, { resultMasterId: 999 })).rejects.toThrow(
      "Result session not found",
    );
  });
});

// ---------------------------------------------------------------------------
// Per-division fail mark + grade scales
// ---------------------------------------------------------------------------

type GradeFixture = { name: string; minMark: number; maxMark: number; divisionId: number | null };

const withDivision = (
  rows: { name: string; minMark: number; maxMark: number }[],
  divisionId: number | null,
): GradeFixture[] => rows.map((row) => ({ ...row, divisionId }));

/** Two processed classes in one madrasa, both with the same three students
 * (averages 90 / 40 / 34). Which division each class sits in, and each
 * division's fail-mark override, come from the options. */
function buildTwoClassScenario(opts: {
  globalFailMark: number;
  divisionFailMarks: Record<number, number | null>;
  classDivision: Record<number, number | null>;
  generalGrades: GradeFixture[];
  madrasaGrades: GradeFixture[];
  miyari?: { passMark: number | null };
}) {
  const marksByStudent: Record<number, number> = { 1: 90, 2: 40, 3: 34 };
  const replacedByMaster = new Map<number, any[]>();
  const calls = { generalGrades: 0, madrasaGrades: 0, settings: 0 };
  const miyariPassMarks: Map<number, number>[] = [];

  const repository = {
    findSettings: async () => {
      calls.settings += 1;
      return [{ name: "fail_mark", value: String(opts.globalFailMark) }];
    },
    findGeneralGrades: async () => {
      calls.generalGrades += 1;
      return opts.generalGrades;
    },
    findMadrasaGrades: async () => {
      calls.madrasaGrades += 1;
      return opts.madrasaGrades;
    },
    findClassGradingScope: async (_madrasaId: number, classId: number) => {
      const divisionId = opts.classDivision[classId] ?? null;
      return {
        divisionId,
        divisionFailMark: divisionId === null ? null : (opts.divisionFailMarks[divisionId] ?? null),
      };
    },
    findResultMasterById: async (id: number) => ({
      id,
      examId: 10,
      classId: id === 100 ? 20 : 21,
      status: "PROCESSING",
    }),
    findProcessedMasters: async () =>
      [
        { id: 100, classId: 20 },
        { id: 101, classId: 21 },
      ].map((m) => ({
        ...m,
        examId: 10,
        status: "PROCESSING",
        exam: { name: "বার্ষিক" },
        class: { nameBn: `শ্রেণি ${m.classId}`, name: `C${m.classId}` },
      })),
    findActiveSubjectsForClass: async () => [
      opts.miyari
        ? { book: { id: 5 }, fullMark: 100, isMiyari: true, passMark: opts.miyari.passMark }
        : { book: { id: 5 }, fullMark: 100, isMiyari: false, passMark: null },
    ],
    findRequiredStudentsInClass: async () =>
      [1, 2, 3].map((id) => ({ id, nameBn: `শিক্ষার্থী ${id}`, roll: id })),
    groupMarksByStudent: async () =>
      Object.entries(marksByStudent).map(([id, mark]) => ({
        studentId: Number(id),
        _sum: { mark },
        _count: { _all: 1 },
      })),
    countAbsentMarksByStudent: async () => [],
    findExemptedMarksByStudent: async () => [],
    findWithheldStudentIds: async () => [],
    findStudentsFailingMiyariSubjects: async (
      _m: number,
      _e: number,
      _c: number,
      _r: number,
      passMarks: Map<number, number>,
    ) => {
      miyariPassMarks.push(passMarks);
      const passMark = passMarks.get(5) ?? 0;
      return Object.entries(marksByStudent)
        .filter(([, mark]) => mark < passMark)
        .map(([id]) => ({ studentId: Number(id) }));
    },
    findRollsByStudentIds: async (ids: number[]) => ids.map((id) => ({ id, roll: id })),
    findResultSummaryForDiff: async () => [],
    replaceResultSummaryInTransaction: async (id: number, summary: any[]) => {
      replacedByMaster.set(id, summary);
    },
    saveResultSummaryInTransaction: async (id: number, summary: any[]) => {
      replacedByMaster.set(id, summary);
    },
    createResultSnapshot: async () => undefined,
  };

  const service = new ResultPanelService(repository as any);
  vi.spyOn(service, "getFullResultView").mockResolvedValue({} as any);
  return { service, replacedByMaster, calls, miyariPassMarks };
}

const DEFAULT_GENERAL = withDivision(GENERAL_GRADES, null);
const DEFAULT_MADRASA = withDivision(MADRASA_GRADES, null);
// Division 2 is stricter: its own fail line is 45 and its own scales start
// higher, so the very same averages grade differently.
const DIV2_GENERAL = withDivision(
  [
    { name: "A+", minMark: 90, maxMark: 100 },
    { name: "B", minMark: 46, maxMark: 89 },
  ],
  2,
);
const DIV2_MADRASA = withDivision(
  [
    { name: "ممتاز", minMark: 90, maxMark: 100 },
    { name: "جيد", minMark: 46, maxMark: 89 },
  ],
  2,
);

const byStudent = (summary: any[]) => Object.fromEntries(summary.map((r) => [r.studentId, r]));

describe("ResultPanelService - per-division grading", () => {
  it("grades classes of different divisions with their own fail mark and scales in one run", async () => {
    const { service, replacedByMaster, calls } = buildTwoClassScenario({
      globalFailMark: 35,
      divisionFailMarks: { 1: null, 2: 45 },
      classDivision: { 20: 1, 21: 2 },
      generalGrades: [...DEFAULT_GENERAL, ...DIV2_GENERAL],
      madrasaGrades: [...DEFAULT_MADRASA, ...DIV2_MADRASA],
    });

    const out = await service.recalculateResults(1, 7, {});

    expect(out.totals.updated).toBe(2);
    const inherit = byStudent(replacedByMaster.get(100)!); // division 1: no override
    expect(inherit[1]).toMatchObject({ status: "PASS", generalGrade: "A+", madrasaGrade: "মুমতায" });
    expect(inherit[2]).toMatchObject({ status: "PASS", generalGrade: "D", madrasaGrade: "মাকবুল" });
    expect(inherit[3]).toMatchObject({ status: "FAIL", generalGrade: "F", madrasaGrade: "রাসিব" });

    const strict = byStudent(replacedByMaster.get(101)!); // division 2: failMark 45, own scale
    expect(strict[1]).toMatchObject({ status: "PASS", generalGrade: "A+", madrasaGrade: "ممتاز" });
    expect(strict[2]).toMatchObject({ status: "FAIL", generalGrade: "F", madrasaGrade: "রাসিব" });
    expect(strict[3]).toMatchObject({ status: "FAIL", generalGrade: "F", madrasaGrade: "রাসিব" });

    // Shared lists are fetched once for the whole run, not once per class.
    expect(calls).toEqual({ generalGrades: 1, madrasaGrades: 1, settings: 1 });
  });

  it("uses the division's own scale with the global fail mark when only the scale is overridden", async () => {
    const { service, replacedByMaster } = buildTwoClassScenario({
      globalFailMark: 35,
      divisionFailMarks: { 2: null },
      classDivision: { 20: 1, 21: 2 },
      generalGrades: [...DEFAULT_GENERAL, ...DIV2_GENERAL],
      madrasaGrades: [...DEFAULT_MADRASA, ...DIV2_MADRASA],
    });

    await service.recalculateResults(1, 7, {});

    const second = byStudent(replacedByMaster.get(101)!);
    // 40 passes the global 35 but sits below division 2's lowest band (46):
    // a PASSED student always gets the lowest passing band, never the fail label.
    expect(second[2]).toMatchObject({ status: "PASS", generalGrade: "B", madrasaGrade: "جيد" });
    expect(second[3]).toMatchObject({ status: "FAIL", generalGrade: "F", madrasaGrade: "রাসিব" });
  });

  it("ignores a legacy fail-named row (F / রাসিব) in the grade lists; a fail still shows the fallback label", async () => {
    const { service, replacedByMaster } = buildTwoClassScenario({
      globalFailMark: 35,
      divisionFailMarks: {},
      classDivision: { 20: 1, 21: 1 },
      // Legacy rows listed FIRST so that, if they were treated as bands, they
      // would win the match for the 34 / 40 averages.
      generalGrades: [{ name: "F", minMark: 0, maxMark: 49, divisionId: null }, ...DEFAULT_GENERAL],
      madrasaGrades: [{ name: "রাসিব", minMark: 0, maxMark: 49, divisionId: null }, ...DEFAULT_MADRASA],
    });

    await service.recalculateResults(1, 7, {});

    const rows = byStudent(replacedByMaster.get(100)!);
    expect(rows[2]).toMatchObject({ status: "PASS", generalGrade: "D", madrasaGrade: "মাকবুল" });
    expect(rows[3]).toMatchObject({ status: "FAIL", generalGrade: "F", madrasaGrade: "রাসিব" });
  });

  it("a division whose only own rows are legacy fail rows falls back to the default scale", async () => {
    const { service, replacedByMaster } = buildTwoClassScenario({
      globalFailMark: 35,
      divisionFailMarks: { 2: null },
      classDivision: { 20: 1, 21: 2 },
      generalGrades: [...DEFAULT_GENERAL, { name: "F", minMark: 0, maxMark: 34, divisionId: 2 }],
      madrasaGrades: [...DEFAULT_MADRASA, { name: "রাসিব", minMark: 0, maxMark: 34, divisionId: 2 }],
    });

    await service.recalculateResults(1, 7, {});

    const rows = byStudent(replacedByMaster.get(101)!);
    expect(rows[2]).toMatchObject({ status: "PASS", generalGrade: "D", madrasaGrade: "মাকবুল" });
  });

  it("a passed average below the lowest band gets the lowest band (also with a legacy fail row present)", async () => {
    const { service, replacedByMaster } = buildTwoClassScenario({
      globalFailMark: 20,
      divisionFailMarks: { 2: null },
      classDivision: { 20: 1, 21: 2 },
      generalGrades: [...DEFAULT_GENERAL, ...DIV2_GENERAL, { name: "F", minMark: 0, maxMark: 45, divisionId: 2 }],
      madrasaGrades: [...DEFAULT_MADRASA, ...DIV2_MADRASA],
    });

    await service.recalculateResults(1, 7, {});

    // 34 and 40 both pass the global 20 but sit under division 2's lowest band (46).
    const rows = byStudent(replacedByMaster.get(101)!);
    expect(rows[2]).toMatchObject({ status: "PASS", generalGrade: "B", madrasaGrade: "جيد" });
    expect(rows[3]).toMatchObject({ status: "PASS", generalGrade: "B", madrasaGrade: "جيد" });
  });

  it("behaves exactly like the madrasa-wide setup when no division has overrides", async () => {
    const { service, replacedByMaster } = buildTwoClassScenario({
      globalFailMark: 35,
      divisionFailMarks: {},
      classDivision: { 20: 1, 21: null },
      generalGrades: DEFAULT_GENERAL,
      madrasaGrades: DEFAULT_MADRASA,
    });

    await service.recalculateResults(1, 7, {});

    for (const masterId of [100, 101]) {
      const rows = byStudent(replacedByMaster.get(masterId)!);
      expect(rows[1]).toMatchObject({ status: "PASS", generalGrade: "A+", madrasaGrade: "মুমতায", rankNo: 1 });
      expect(rows[2]).toMatchObject({ status: "PASS", generalGrade: "D", madrasaGrade: "মাকবুল", rankNo: 2 });
      expect(rows[3]).toMatchObject({ status: "FAIL", generalGrade: "F", madrasaGrade: "রাসিব", rankNo: 3 });
    }
  });

  it("lets a miyari subject's own pass mark win over the division fail mark, else falls back to it", async () => {
    const shared = {
      globalFailMark: 35,
      divisionFailMarks: { 2: 45 },
      classDivision: { 20: 1, 21: 2 },
      generalGrades: [...DEFAULT_GENERAL, ...DIV2_GENERAL],
      madrasaGrades: [...DEFAULT_MADRASA, ...DIV2_MADRASA],
    };

    const withPassMark = buildTwoClassScenario({ ...shared, miyari: { passMark: 20 } });
    await withPassMark.service.recalculateResults(1, 7, {});
    expect(withPassMark.miyariPassMarks.map((m) => m.get(5))).toEqual([20, 20]);

    const fallback = buildTwoClassScenario({ ...shared, miyari: { passMark: null } });
    await fallback.service.recalculateResults(1, 7, {});
    expect(fallback.miyariPassMarks.map((m) => m.get(5))).toEqual([35, 45]); // per-division fail mark
  });

  it("re-grades a single session (correction path) with its own division's rules", async () => {
    const { service, replacedByMaster } = buildTwoClassScenario({
      globalFailMark: 35,
      divisionFailMarks: { 2: 45 },
      classDivision: { 20: 1, 21: 2 },
      generalGrades: [...DEFAULT_GENERAL, ...DIV2_GENERAL],
      madrasaGrades: [...DEFAULT_MADRASA, ...DIV2_MADRASA],
    });

    await service.reprocessResultMaster(1, 101);

    expect(byStudent(replacedByMaster.get(101)!)[2]).toMatchObject({ status: "FAIL", generalGrade: "F" });
  });
});
