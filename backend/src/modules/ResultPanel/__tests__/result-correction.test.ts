import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- in-memory fake of the slice of Prisma the correction service uses ----
// Model methods return LAZY thenables, like Prisma's own PrismaPromise: an
// operation only runs when awaited (directly or by $transaction). That is
// what lets the tests prove "nothing was written" when a transaction fails.
const lazy = <T,>(fn: () => Promise<T> | T) => {
  let started: Promise<T> | null = null;
  return {
    then: (res: (v: T) => unknown, rej?: (e: unknown) => unknown) => {
      started ??= Promise.resolve().then(fn);
      return started.then(res, rej);
    },
  };
};

const db = vi.hoisted(() => ({
  corrections: [] as any[],
  marks: [] as any[],
  markUpdates: [] as { where: any; data: any }[],
  snapshots: [] as any[],
  failTransaction: false,
  nextId: 1,
}));

const matches = (row: any, where: any) =>
  Object.entries(where).every(([key, cond]: [string, any]) => {
    if (cond && typeof cond === "object" && !(cond instanceof Date) && "in" in cond) return cond.in.includes(row[key]);
    if (cond instanceof Date) return row[key]?.getTime() === cond.getTime();
    return row[key] === cond;
  });

vi.mock("../../../shared/database/prisma", () => {
  const prisma: any = {
    mark: {
      findMany: async () => db.marks,
      updateMany: (args: any) =>
        lazy(async () => {
          db.markUpdates.push(args);
          return { count: 1 };
        }),
    },
    resultSummary: { updateMany: () => lazy(async () => ({ count: 1 })) },
    resultSnapshot: {
      create: async (args: any) => {
        db.snapshots.push(args.data);
        return args.data;
      },
    },
    resultCorrection: {
      createMany: async ({ data }: any) => {
        for (const d of data) db.corrections.push({ id: db.nextId++, decidedBy: null, ...d });
        return { count: data.length };
      },
      findMany: async ({ where }: any) => db.corrections.filter((r) => matches(r, where)),
      findFirst: async ({ where }: any) => db.corrections.find((r) => matches(r, where)) ?? null,
      updateMany: ({ where, data }: any) =>
        lazy(async () => {
          const hit = db.corrections.filter((r) => matches(r, where));
          hit.forEach((r) => Object.assign(r, data));
          return { count: hit.length };
        }),
    },
    $transaction: async (ops: any[]) => {
      if (db.failTransaction) throw new Error("db down");
      const out = [];
      for (const op of ops) out.push(await op);
      return out;
    },
  };
  return { prisma };
});
vi.mock("../../../shared/utils/activity.util", () => ({ logActivity: vi.fn(async () => undefined) }));
vi.mock("../../../shared/utils/rbac.util", () => ({
  hasFullResultAuthority: vi.fn(),
  hasExamDepartmentAuthority: vi.fn(),
}));
vi.mock("../result-panel.repository", () => ({
  resultPanelRepository: {
    findResultMasterById: vi.fn(async (id: number) => ({ id, examId: 10, classId: 20, status: "PUBLISHED" })),
    findActiveSubjectsForClass: vi.fn(async () => [
      { book: { id: 5 }, fullMark: 100 },
      { book: { id: 6 }, fullMark: 50 },
    ]),
  },
}));
vi.mock("../result-panel.service", () => ({
  resultPanelService: {
    reprocessResultMaster: vi.fn(async () => undefined),
    getFullResultView: vi.fn(async () => ({ students: [] })),
  },
}));

import { hasFullResultAuthority } from "../../../shared/utils/rbac.util";
import { resultPanelService } from "../result-panel.service";
import { ResultCorrectionService } from "../result-correction.service";

const markRow = (bookId: number, over: Record<string, unknown> = {}) => ({
  studentId: 1,
  bookId,
  mark: 40,
  isAbsent: false,
  isExempted: false,
  isWithheld: false,
  note: null,
  ...over,
});

const BATCH = {
  reason: "নম্বর তোলায় ভুল হয়েছিল",
  items: [
    { student_id: 1, book_id: 5, field: "mark", new_value: 55 },
    { student_id: 1, book_id: 6, field: "is_absent", new_value: false },
    { student_id: 1, book_id: 6, field: "mark", new_value: 30 },
  ],
};

describe("ResultCorrectionService.requestCorrectionBatch", () => {
  const service = new ResultCorrectionService();

  beforeEach(() => {
    db.corrections.length = 0;
    db.markUpdates.length = 0;
    db.snapshots.length = 0;
    db.failTransaction = false;
    db.nextId = 1;
    db.marks.length = 0;
    db.marks.push(markRow(5), markRow(6, { mark: 0, isAbsent: true }));
    vi.mocked(hasFullResultAuthority).mockReset();
    vi.mocked(resultPanelService.reprocessResultMaster).mockClear();
  });

  it("applies immediately for a full-authority actor: one merged UPDATE per cell, one re-grade, one snapshot", async () => {
    vi.mocked(hasFullResultAuthority).mockResolvedValue(true);

    const out = await service.requestCorrectionBatch(1, 7, 100, { ...BATCH, apply_now: true });

    expect(out.applied).toBe(true);
    expect(db.corrections).toHaveLength(3);
    expect(db.corrections.every((c) => c.status === "APPLIED" && c.decidedBy === 7)).toBe(true);

    // is_absent + mark of book 6 collapsed into ONE update of that cell.
    expect(db.markUpdates).toHaveLength(2);
    const cell5 = db.markUpdates.find((u) => u.where.bookId === 5)!;
    const cell6 = db.markUpdates.find((u) => u.where.bookId === 6)!;
    expect(cell5.data).toEqual({ mark: 55 });
    expect(cell6.data).toEqual({ isAbsent: false, mark: 30 });

    expect(resultPanelService.reprocessResultMaster).toHaveBeenCalledTimes(1);
    expect(db.snapshots).toHaveLength(1);
    expect(db.snapshots[0].reason).toBe("CORRECTION");
  });

  it("leaves everything PENDING when the actor lacks full authority, even with apply_now", async () => {
    vi.mocked(hasFullResultAuthority).mockResolvedValue(false);

    const out = await service.requestCorrectionBatch(1, 7, 100, { ...BATCH, apply_now: true });

    expect(out.applied).toBe(false);
    expect(db.corrections.every((c) => c.status === "PENDING")).toBe(true);
    expect(db.markUpdates).toHaveLength(0);
    expect(resultPanelService.reprocessResultMaster).not.toHaveBeenCalled();
  });

  it("only requests (never applies) when apply_now is not set", async () => {
    vi.mocked(hasFullResultAuthority).mockResolvedValue(true);

    const out = await service.requestCorrectionBatch(1, 7, 100, BATCH);

    expect(out.applied).toBe(false);
    expect(db.corrections.every((c) => c.status === "PENDING")).toBe(true);
    expect(db.markUpdates).toHaveLength(0);
  });

  it("rejects a mark above the subject's full marks before creating anything", async () => {
    await expect(
      service.requestCorrectionBatch(1, 7, 100, {
        reason: "x",
        items: [{ student_id: 1, book_id: 6, field: "mark", new_value: 51 }], // book 6 is out of 50
      }),
    ).rejects.toThrow("পূর্ণমান");
    expect(db.corrections).toHaveLength(0);
  });

  it("rejects an empty reason and duplicate cells in one batch", async () => {
    await expect(service.requestCorrectionBatch(1, 7, 100, { ...BATCH, reason: "  " })).rejects.toThrow(
      "কারণ",
    );
    await expect(
      service.requestCorrectionBatch(1, 7, 100, {
        reason: "x",
        items: [
          { student_id: 1, book_id: 5, field: "mark", new_value: 1 },
          { student_id: 1, book_id: 5, field: "mark", new_value: 2 },
        ],
      }),
    ).rejects.toThrow("একাধিকবার");
    expect(db.corrections).toHaveLength(0);
  });

  it("changes no marks and releases the claim back to PENDING if the transaction fails", async () => {
    vi.mocked(hasFullResultAuthority).mockResolvedValue(true);
    db.failTransaction = true;

    await expect(service.requestCorrectionBatch(1, 7, 100, { ...BATCH, apply_now: true })).rejects.toThrow(
      "db down",
    );

    expect(db.markUpdates).toHaveLength(0);
    expect(db.corrections.every((c) => c.status === "PENDING" && c.decidedBy === null)).toBe(true);
    expect(resultPanelService.reprocessResultMaster).not.toHaveBeenCalled();
  });
});

describe("ResultCorrectionService.decide", () => {
  const service = new ResultCorrectionService();

  it("backs out instead of double-applying when the request was already decided elsewhere", async () => {
    db.corrections.length = 0;
    db.markUpdates.length = 0;
    // findFirst sees it PENDING, but by claim time another approver applied it.
    const stale = { id: 1, madrasaId: 1, resultMasterId: 100, requestedBy: 9, decidedBy: 3, status: "PENDING" };
    db.corrections.push(stale);
    const { prisma } = await import("../../../shared/database/prisma");
    const realFindFirst = (prisma as any).resultCorrection.findFirst;
    (prisma as any).resultCorrection.findFirst = async () => ({ ...stale });
    db.corrections[0].status = "APPLIED";

    await expect(service.decide(1, 7, 1, true)).rejects.toThrow("ইতিমধ্যে সিদ্ধান্ত");
    expect(db.markUpdates).toHaveLength(0);

    (prisma as any).resultCorrection.findFirst = realFindFirst;
  });
});
