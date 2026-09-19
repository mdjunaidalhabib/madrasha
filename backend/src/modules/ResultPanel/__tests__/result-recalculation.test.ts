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
