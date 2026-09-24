import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../session/session.repository", () => ({ sessionRepository: {} }));
vi.mock("../fee.service", () => ({
  feeService: { backfillInvoicesForAllStudents: vi.fn(async () => ({ invoicesCreated: 3 })) },
}));

import { feeService } from "../fee.service";
import { ExamFeeService } from "../exam-fee.service";
import { ConflictError, BadRequestError } from "../../../shared/errors";

const M = 1;
const HIFZ = 10;
const KITAB = 20;
// classes: 101, 102 in হিফজ; 201 in কিতাব
const CLASSES = [
  { classId: 101, className: "হিফজ ১", divisionId: HIFZ, divisionName: "হিফজ", order: 0 },
  { classId: 102, className: "হিফজ ২", divisionId: HIFZ, divisionName: "হিফজ", order: 1 },
  { classId: 201, className: "মিজান", divisionId: KITAB, divisionName: "কিতাব", order: 2 },
];

type Row = {
  id: number;
  examId: number;
  classId: number | null;
  amount: Prisma.Decimal;
  isActive: boolean;
  sessionId: number;
  _count: { invoices: number };
};

function build(opts: { examActive?: boolean; divisions?: number[]; rows?: Partial<Row>[]; template?: number | null }) {
  let nextId = 500;
  const exam = {
    id: 7,
    name: "বার্ষিক",
    year: "2026",
    isActive: opts.examActive ?? false,
    divisions: (opts.divisions ?? []).map((divisionId) => ({ divisionId })),
  };
  const rows: Row[] = (opts.rows ?? []).map((r) => ({
    id: nextId++,
    examId: 7,
    classId: 101,
    amount: new Prisma.Decimal(100),
    isActive: false,
    sessionId: 1,
    _count: { invoices: 0 },
    ...r,
  }));

  const repository = {
    findExams: vi.fn(async () => [exam]),
    findActiveClasses: vi.fn(async () => CLASSES),
    findExamFeeRows: vi.fn(async () => rows.map((r) => ({ ...r }))),
    findLatestExamFeeAmount: vi.fn(async () => null),
    findTemplateExamFeeAmount: vi.fn(async () =>
      opts.template == null ? null : { classId: null, amount: new Prisma.Decimal(opts.template) },
    ),
    createRow: vi.fn(async (data: any) => {
      const row = { id: nextId++, _count: { invoices: 0 }, ...data };
      rows.push(row);
      return row;
    }),
    updateRow: vi.fn(async (id: number, _m: number, data: any) => {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, data);
      return { count: row ? 1 : 0 };
    }),
    deleteRow: vi.fn(async (id: number) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
      return { count: i >= 0 ? 1 : 0 };
    }),
  };
  const sessions = { findCurrentSession: vi.fn(async () => ({ id: 1, name: "2026" })) };
  const service = new ExamFeeService(repository as any, sessions as any);
  return { service, repository, rows, exam };
}

beforeEach(() => vi.mocked(feeService.backfillInvoicesForAllStudents).mockClear());

describe("ExamFeeService.syncExam - পরীক্ষার ফি follows the exam's বিভাগ", () => {
  it("creates a dormant row for every covered class from the template", async () => {
    const { service, rows } = build({ divisions: [HIFZ], template: 150 });
    await service.syncExam(M, 7);
    expect(rows.map((r) => r.classId).sort()).toEqual([101, 102]);
    expect(rows.every((r) => !r.isActive && Number(r.amount) === 150)).toBe(true);
    expect(feeService.backfillInvoicesForAllStudents).not.toHaveBeenCalled();
  });

  it("drops unbilled rows of classes that left the scope, but only switches off billed ones", async () => {
    const { service, rows } = build({
      divisions: [HIFZ],
      rows: [
        { classId: 101 },
        { classId: 201, _count: { invoices: 0 } },
      ],
    });
    await service.syncExam(M, 7);
    expect(rows.find((r) => r.classId === 201)).toBeUndefined();

    const billed = build({
      divisions: [HIFZ],
      rows: [{ classId: 101, isActive: true }, { classId: 201, isActive: true, _count: { invoices: 4 } }],
    });
    await billed.service.syncExam(M, 7);
    expect(billed.rows.find((r) => r.classId === 201)?.isActive).toBe(false);
  });

  it("bills newly covered classes immediately when the exam's fee is already live", async () => {
    const { service, rows } = build({
      divisions: [HIFZ, KITAB],
      rows: [{ classId: 101, isActive: true }, { classId: 102, isActive: true }],
      template: 100,
    });
    await service.syncExam(M, 7);
    const kitab = rows.find((r) => r.classId === 201);
    expect(kitab?.isActive).toBe(true);
    expect(feeService.backfillInvoicesForAllStudents).toHaveBeenCalledWith(M, 201, 1);
  });

  it("splits an unbilled legacy 'every class' row into per-class rows with its amount", async () => {
    const { service, rows } = build({ divisions: [KITAB], rows: [{ classId: null, amount: new Prisma.Decimal(80) }] });
    await service.syncExam(M, 7);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ classId: 201 });
    expect(Number(rows[0].amount)).toBe(80);
  });

  it("leaves a billed legacy row alone (per-class rows would double-bill)", async () => {
    const { service, rows, repository } = build({
      rows: [{ classId: null, _count: { invoices: 2 } }],
      template: 100,
    });
    await service.syncExam(M, 7);
    expect(rows).toHaveLength(1);
    expect(repository.createRow).not.toHaveBeenCalled();
  });
});

describe("ExamFeeService.setAmounts", () => {
  it("creates, updates and removes in one batch", async () => {
    const { service, rows } = build({ rows: [{ classId: 101 }, { classId: 102 }] });
    const result = await service.setAmounts(M, 7, [
      { class_id: 101, amount: 200 },
      { class_id: 102, amount: 0 },
      { class_id: 201, amount: "120" },
    ]);
    expect(result).toMatchObject({ created: 1, updated: 1, removed: 1 });
    expect(Number(rows.find((r) => r.classId === 101)?.amount)).toBe(200);
    expect(rows.find((r) => r.classId === 102)).toBeUndefined();
  });

  it("refuses a class outside the exam's বিভাগ", async () => {
    const { service } = build({ divisions: [HIFZ] });
    await expect(service.setAmounts(M, 7, [{ class_id: 201, amount: 100 }])).rejects.toBeInstanceOf(BadRequestError);
  });

  it("refuses to remove a fee that has already been invoiced, writing nothing", async () => {
    const { service, repository } = build({ rows: [{ classId: 101, _count: { invoices: 5 } }] });
    await expect(
      service.setAmounts(M, 7, [
        { class_id: 102, amount: 100 },
        { class_id: 101, amount: null },
      ]),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.createRow).not.toHaveBeenCalled();
  });
});
