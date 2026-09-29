import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findMany: vi.fn() },
  class: { findMany: vi.fn() },
  madrasaClass: { findMany: vi.fn() },
}));
vi.mock("../../database/prisma", () => ({ prisma: prismaMock }));

import { buildSnapshotDetails, describeStudentsByClass, findSnapshotLoader } from "../activityDetails";

const snap = (fields: Record<string, string>) => ({ madrasaId: 1, title: "পরীক্ষা: বার্ষিক (2026)", fields });

describe("buildSnapshotDetails", () => {
  it("lists only changed fields as old → new", () => {
    const text = buildSnapshotDetails(
      snap({ নাম: "বার্ষিক", অবস্থা: "বন্ধ" }),
      snap({ নাম: "বার্ষিক", অবস্থা: "চালু" }),
    );
    expect(text).toBe("পরীক্ষা: বার্ষিক (2026)\nঅবস্থা: বন্ধ → চালু");
  });

  it("shows fields that appeared or disappeared (e.g. a class fee added)", () => {
    const text = buildSnapshotDetails(snap({ "হিফজ শ্রেণির ফি": "৳300" }), snap({ "নাজেরা শ্রেণির ফি": "৳200" }));
    expect(text).toBe("পরীক্ষা: বার্ষিক (2026)\nনাজেরা শ্রেণির ফি: — → ৳200\nহিফজ শ্রেণির ফি: ৳300 → —");
  });

  it("says nothing changed when every field is equal", () => {
    expect(buildSnapshotDetails(snap({ নাম: "x" }), snap({ নাম: "x" }))).toContain("কোনো তথ্য পরিবর্তন হয়নি");
  });

  it("summarises a deleted record, skipping empty fields", () => {
    const text = buildSnapshotDetails({ ...snap({ বছর: "2026", বিবরণ: "—" }), summary: ["বছর", "বিবরণ"] }, null);
    expect(text).toBe("পরীক্ষা: বার্ষিক (2026)\nবছর: 2026");
  });

  it("returns null without snapshots so the caller falls back", () => {
    expect(buildSnapshotDetails(null, null)).toBeNull();
  });
});

describe("findSnapshotLoader", () => {
  it("covers exam fee routes and every student sub-route", () => {
    expect(findSnapshotLoader("fee-structures/exam-fees")).toBeTypeOf("function");
    expect(findSnapshotLoader("fee-structures/exam-fees/status")).toBeTypeOf("function");
    expect(findSnapshotLoader("students/expel")).toBe(findSnapshotLoader("students"));
    expect(findSnapshotLoader("classes")).toBeNull();
  });
});

describe("describeStudentsByClass", () => {
  it("groups students under their class in the madrasa's class order", async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { id: 1, nameBn: "আব্দুল্লাহ", roll: null, registrationNo: null, classId: 20 },
      { id: 2, nameBn: "উমর", roll: 3, registrationNo: 501, classId: 10 },
      { id: 3, nameBn: "আলী", roll: null, registrationNo: null, classId: 20 },
    ]);
    prismaMock.class.findMany.mockResolvedValue([
      { id: 10, nameBn: "নাহবেমীর", name: null, madrasaClasses: [] },
      { id: 20, nameBn: "মিজান", name: null, madrasaClasses: [{ nameBn: "মিজান (নতুন)" }] },
    ]);
    // Class 20 is ordered before class 10 in this madrasa.
    prismaMock.madrasaClass.findMany.mockResolvedValue([
      { classId: 20, sortOrder: 1 },
      { classId: 10, sortOrder: 2 },
    ]);

    const text = await describeStudentsByClass(7, [1, 2, 3], "মোট ৩ জন", new Map([[1, "নতুন"]]));

    expect(text).toBe(
      [
        "মোট ৩ জন",
        "• শ্রেণি: মিজান (নতুন) — 2 জন",
        "    1. আব্দুল্লাহ (নতুন)",
        "    2. আলী",
        "• শ্রেণি: নাহবেমীর — 1 জন",
        "    1. উমর (রোল: 3, রেজি: 501)",
      ].join("\n"),
    );
  });
});
