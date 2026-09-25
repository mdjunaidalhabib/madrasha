import { describe, expect, it, vi } from "vitest";

vi.mock("../../database/prisma", () => ({ prisma: {} }));

import { buildSnapshotDetails, findSnapshotLoader } from "../activityDetails";

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
