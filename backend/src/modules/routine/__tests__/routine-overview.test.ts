import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  madrasaClass: { findMany: vi.fn() },
  exam: { findMany: vi.fn() },
  examRoutine: { findMany: vi.fn() },
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: db }));
import { RoutineRepository } from "../routine.repository";

describe("exam routine preparation overview", () => {
  it("hides inactive routines from guardians while keeping them available for administration", async () => {
    db.examRoutine.findMany.mockResolvedValue([]);
    const repository = new RoutineRepository();
    await repository.findExamRoutines(7, undefined, 10, true);
    expect(db.examRoutine.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { madrasaId: 7, classId: 10, exam: { deletedAt: null }, status: "PUBLISHED" },
    }));
    await repository.findExamRoutines(7, undefined, 10);
    expect(db.examRoutine.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { madrasaId: 7, classId: 10, exam: { deletedAt: null } },
    }));
  });

  it("shows a dormant exam's draft schedule without activating the exam", async () => {
    db.madrasaClass.findMany.mockResolvedValue([
      { classId: 10, nameBn: "Tenant class", class: { divisionId: 3, division: { nameBn: "Division" } } },
      { classId: 11, nameBn: "Empty class", class: { divisionId: 3, division: { nameBn: "Division" } } },
    ]);
    db.exam.findMany.mockResolvedValue([{ id: 2, name: "Demo exam", year: "2026", isActive: false }]);
    db.examRoutine.findMany.mockResolvedValue([{ examId: 2, classId: 10, status: "DRAFT" }]);
    const rows = await new RoutineRepository().findExamRoutineOverview(7);
    expect(rows).toEqual([
      expect.objectContaining({ examId: 2, classId: 10, className: "Tenant class", subjectCount: 1, status: "DRAFT" }),
      expect.objectContaining({ examId: 2, classId: 11, subjectCount: 0, status: "NONE" }),
    ]);
    expect(db.exam.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { madrasaId: 7, deletedAt: null } }));
    expect(db.examRoutine.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { madrasaId: 7, exam: { madrasaId: 7, deletedAt: null } } }));
  });
});
