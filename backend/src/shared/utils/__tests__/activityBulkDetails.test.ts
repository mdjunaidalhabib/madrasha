import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findMany: vi.fn() },
  class: { findMany: vi.fn() },
  division: { findMany: vi.fn() },
  madrasaClass: { findMany: vi.fn() },
  exam: { findFirst: vi.fn() },
  book: { findMany: vi.fn() },
}));
vi.mock("../../database/prisma", () => ({ prisma: prismaMock }));

import { findBulkDescriber } from "../activityBulkDetails";

const describe_ = (entity: string, ctx: { body?: any; response?: any; before?: unknown }) =>
  findBulkDescriber(entity)!.describe({ madrasaId: 7, body: ctx.body, response: ctx.response, before: ctx.before });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.class.findMany.mockResolvedValue([
    { id: 10, nameBn: "নাহবেমীর", name: null, madrasaClasses: [] },
    { id: 11, nameBn: "হেদায়াতুন্নাহু", name: null, madrasaClasses: [] },
  ]);
  prismaMock.madrasaClass.findMany.mockResolvedValue([]);
});

describe("activity bulk describers", () => {
  it("covers every bulk route", () => {
    for (const entity of [
      "students/bulk",
      "students/names",
      "teachers/bulk",
      "teachers/bulk-update",
      "attendance/bulk",
      "exam-attendance/bulk",
      "promotion/execute",
      "results/marks",
      "invoices/backfill",
      "invoices/pending/clear",
      "payroll/generate",
    ]) {
      expect(findBulkDescriber(entity), entity).not.toBeNull();
    }
    expect(findBulkDescriber("students")).toBeNull();
  });

  it("attendance: counts in the headline, people grouped by status (absent first)", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: 1, nameBn: "আব্দুল্লাহ", roll: 1 },
      { id: 2, nameBn: "উমর", roll: 2 },
      { id: 3, nameBn: "আলী", roll: 3 },
    ]);
    const text = await describe_("attendance/bulk", {
      body: {
        attendee_type: "STUDENT",
        date: "2026-09-28",
        class_id: 10,
        entries: [
          { attendee_id: 1, status: "PRESENT" },
          { attendee_id: 2, status: "ABSENT" },
          { attendee_id: 3, status: "PRESENT" },
        ],
      },
    });
    expect(text).toBe(
      [
        "তারিখ: 2026-09-28, শ্রেণি: নাহবেমীর, মোট 3 জন শিক্ষার্থীর হাজিরা — অনুপস্থিত: 1, উপস্থিত: 2",
        "• অনুপস্থিত — 1 জন",
        "    1. উমর (রোল: 2)",
        "• উপস্থিত — 2 জন",
        "    1. আব্দুল্লাহ (রোল: 1)",
        "    2. আলী (রোল: 3)",
      ].join("\n"),
    );
  });

  it("promotion: from → to class, students grouped by decision", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: 1, nameBn: "আব্দুল্লাহ" },
      { id: 2, nameBn: "উমর" },
    ]);
    const text = await describe_("promotion/execute", {
      body: {
        from_class_id: 10,
        to_class_id: 11,
        from_year: "2026",
        to_year: "2027",
        decisions: [
          { student_id: 1, status: "PROMOTED" },
          { student_id: 2, status: "RETAINED" },
        ],
      },
    });
    expect(text?.split("\n")).toEqual([
      "নাহবেমীর (2026) → হেদায়াতুন্নাহু (2027) — মোট 2 জন: প্রমোশন পেয়েছে: 1, একই শ্রেণিতে রাখা হয়েছে: 1",
      "• প্রমোশন পেয়েছে — 1 জন",
      "    1. আব্দুল্লাহ",
      "• একই শ্রেণিতে রাখা হয়েছে — 1 জন",
      "    1. উমর",
    ]);
  });

  it("marks: exam/class headline, subject list, one line per student", async () => {
    prismaMock.exam.findFirst.mockResolvedValue({ name: "বার্ষিক", year: 2026 });
    prismaMock.book.findMany.mockResolvedValue([{ id: 5, nameBn: "নাহবেমীর কিতাব", name: null }]);
    prismaMock.student.findMany.mockResolvedValue([
      { id: 1, nameBn: "আব্দুল্লাহ", roll: 1 },
      { id: 2, nameBn: "উমর", roll: 2 },
    ]);
    const row = { exam_id: 3, class_id: 10, book_id: 5 };
    const text = await describe_("results/marks", {
      body: {
        data: [
          { ...row, student_id: 1, mark: 78 },
          { ...row, student_id: 2, mark: 0, is_absent: true },
        ],
      },
    });
    expect(text?.split("\n")).toEqual([
      "পরীক্ষা: বার্ষিক (2026), শ্রেণি: নাহবেমীর, 2 জন শিক্ষার্থীর নম্বর সংরক্ষণ করা হয়েছে",
      "বিষয়: নাহবেমীর কিতাব",
      "    1. আব্দুল্লাহ (রোল: 1) — 78",
      "    2. উমর (রোল: 2) — অনুপস্থিত",
    ]);
  });

  it("names page: only changed names, old → new under the student", async () => {
    const before = [
      { id: 1, madrasaId: 7, nameBn: "আব্দুল্লা", nameEn: null },
      { id: 2, madrasaId: 7, nameBn: "উমর", nameEn: "Umar" },
      { id: 9, madrasaId: 99, nameBn: "অন্য মাদ্রাসা" },
    ];
    prismaMock.student.findMany
      // after-state
      .mockResolvedValueOnce([
        { id: 1, nameBn: "আব্দুল্লাহ", nameEn: "Abdullah" },
        { id: 2, nameBn: "উমর", nameEn: "Umar" },
      ])
      // describeStudentsByClass
      .mockResolvedValueOnce([{ id: 1, nameBn: "আব্দুল্লাহ", roll: 1, registrationNo: null, classId: 10 }]);
    const text = await describe_("students/names", { before });
    expect(text?.split("\n")).toEqual([
      "মোট 1 জন শিক্ষার্থীর নাম হালনাগাদ করা হয়েছে",
      "• শ্রেণি: নাহবেমীর — 1 জন",
      "    1. আব্দুল্লাহ (রোল: 1)",
      "        নাম (বাংলা): আব্দুল্লা → আব্দুল্লাহ",
      "        নাম (ইংরেজি): — → Abdullah",
    ]);
  });
});
