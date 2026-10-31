import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  madrasaClass: { findMany: vi.fn() },
  madrasaBook: { findMany: vi.fn() },
  teacherAssignment: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: db }));

import { TeacherAssignmentRepository } from "../teacher-assignment.repository";
import { TeacherAssignmentService } from "../teacher-assignment.service";

beforeEach(() => vi.clearAllMocks());

describe("teacher assignment catalogue", () => {
  it("uses tenant class names and excludes books belonging to inactive classes", async () => {
    db.madrasaClass.findMany.mockResolvedValue([
      { nameBn: "Tenant class", class: { id: 10, nameBn: "Catalogue class", divisionId: 3 } },
      { nameBn: null, class: { id: 11, nameBn: "Another class", divisionId: 3 } },
    ]);
    db.madrasaBook.findMany.mockResolvedValue([
      { book: { id: 20, nameBn: "Book one", classId: 10 } },
      { book: { id: 21, nameBn: "Hidden class book", classId: 99 } },
    ]);
    const result = await new TeacherAssignmentRepository().getCatalog(7);
    expect(db.madrasaClass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { madrasaId: 7, isActive: 1, deletedAt: null } }),
    );
    expect(db.madrasaBook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { madrasaId: 7, isActive: 1, deletedAt: null } }),
    );
    expect(result.classes).toEqual([
      { class_id: 10, class_name_bn: "Tenant class", division_id: 3 },
      { class_id: 11, class_name_bn: "Another class", division_id: 3 },
    ]);
    expect(result.books).toEqual([{ book_id: 20, book_name_bn: "Book one", class_id: 10 }]);
  });
});

describe("editing an assignment", () => {
  it("submits the delete and replacement to one transaction scoped to the tenant and class", async () => {
    const deleteOperation = { operation: "delete" };
    const createOperation = { operation: "create" };
    db.teacherAssignment.deleteMany.mockReturnValue(deleteOperation);
    db.teacherAssignment.createMany.mockReturnValue(createOperation);
    db.$transaction.mockResolvedValue([{ count: 2 }, { count: 1 }]);
    await new TeacherAssignmentService(new TeacherAssignmentRepository()).updateAssignment(
      7,
      2,
      10,
      [20],
    );
    expect(db.teacherAssignment.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, teacherId: 2, classId: 10 },
    });
    expect(db.teacherAssignment.createMany).toHaveBeenCalledWith({
      data: [{ madrasaId: 7, teacherId: 2, classId: 10, bookId: 20 }],
    });
    expect(db.$transaction).toHaveBeenCalledWith([deleteOperation, createOperation]);
  });

  it("propagates transaction failure without retrying a destructive standalone delete", async () => {
    db.$transaction.mockRejectedValue(new Error("write failed"));
    await expect(
      new TeacherAssignmentService(new TeacherAssignmentRepository()).updateAssignment(
        7,
        2,
        10,
        [20],
      ),
    ).rejects.toThrow("write failed");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.teacherAssignment.deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe("new assignment across classes", () => {
  const groups = [
    { class_id: 10, book_ids: [20] },
    { class_id: 11, book_ids: [21] },
  ];
  const makeRepo = () => ({
    findTeacher: vi.fn().mockResolvedValue({ id: 2 }),
    countForTeacher: vi.fn().mockResolvedValue(0),
    getCatalog: vi.fn().mockResolvedValue({
      books: [
        { book_id: 20, class_id: 10 },
        { book_id: 21, class_id: 11 },
      ],
    }),
    findAssignedBooks: vi.fn().mockResolvedValue([]),
    createGrouped: vi.fn().mockResolvedValue({ count: 2 }),
  });
  it("saves selections across classes together", async () => {
    const repo = makeRepo();
    await new TeacherAssignmentService(repo as unknown as TeacherAssignmentRepository).saveGrouped(
      7,
      2,
      groups,
    );
    expect(repo.findTeacher).toHaveBeenCalledWith(7, 2);
    expect(repo.findAssignedBooks).toHaveBeenCalledWith(7, [20, 21]);
    expect(repo.createGrouped).toHaveBeenCalledWith(7, 2, groups);
  });
  it("keeps each book's own class in one atomic insert", async () => {
    await new TeacherAssignmentRepository().createGrouped(7, 2, groups);
    expect(db.teacherAssignment.createMany).toHaveBeenCalledWith({
      data: [
        { madrasaId: 7, teacherId: 2, classId: 10, bookId: 20 },
        { madrasaId: 7, teacherId: 2, classId: 11, bookId: 21 },
      ],
    });
  });
  it.each([
    [[{ class_id: 10, book_ids: [21] }]],
    [[{ class_id: 10, book_ids: [999] }]],
    [[{ class_id: 10, book_ids: [20, 20] }]],
    [[{ class_id: 10, book_ids: [] }]],
    [[]],
  ])("rejects invalid class/book selections without writing", async (invalidGroups) => {
    const repo = makeRepo();
    await expect(
      new TeacherAssignmentService(repo as unknown as TeacherAssignmentRepository).saveGrouped(
        7,
        2,
        invalidGroups,
      ),
    ).rejects.toThrow();
    expect(repo.createGrouped).not.toHaveBeenCalled();
  });
  it("rejects selections already assigned to another teacher without writing", async () => {
    const repo = makeRepo();
    repo.findAssignedBooks.mockResolvedValue([{ bookId: 20 }]);
    await expect(
      new TeacherAssignmentService(repo as unknown as TeacherAssignmentRepository).saveGrouped(
        7,
        2,
        groups,
      ),
    ).rejects.toThrow();
    expect(repo.createGrouped).not.toHaveBeenCalled();
  });
  it("rejects teachers outside this tenant without writing", async () => {
    const repo = makeRepo();
    repo.findTeacher.mockResolvedValue(null);
    await expect(
      new TeacherAssignmentService(repo as unknown as TeacherAssignmentRepository).saveGrouped(
        7,
        2,
        groups,
      ),
    ).rejects.toThrow();
    expect(repo.createGrouped).not.toHaveBeenCalled();
  });
});

describe("editing the teacher's entire assignment", () => {
  const groups = [
    { class_id: 10, book_ids: [20] },
    { class_id: 11, book_ids: [21] },
  ];
  const makeRepo = () => ({
    findTeacher: vi.fn().mockResolvedValue({ id: 2 }),
    countForTeacher: vi.fn().mockResolvedValue(3),
    getCatalog: vi.fn().mockResolvedValue({
      books: [
        { book_id: 20, class_id: 10 },
        { book_id: 21, class_id: 11 },
      ],
    }),
    findAllForTenant: vi.fn().mockResolvedValue([{ teacher: { id: 2 }, bookId: 99, classId: 12 }]),
    findAssignedBooks: vi.fn().mockResolvedValue([]),
    replaceGrouped: vi.fn().mockResolvedValue([]),
  });
  it("updates all classes and excludes this teacher from conflict checks", async () => {
    const repo = makeRepo();
    await new TeacherAssignmentService(repo as unknown as TeacherAssignmentRepository).saveGrouped(
      7,
      2,
      groups,
      true,
    );
    expect(repo.findAssignedBooks).toHaveBeenCalledWith(7, [20, 21], 2);
    expect(repo.replaceGrouped).toHaveBeenCalledWith(7, 2, groups);
  });
  it("allows retaining an existing inactive subject", async () => {
    const repo = makeRepo();
    const retained = [...groups, { class_id: 12, book_ids: [99] }];
    await new TeacherAssignmentService(repo as unknown as TeacherAssignmentRepository).saveGrouped(
      7,
      2,
      retained,
      true,
    );
    expect(repo.replaceGrouped).toHaveBeenCalledWith(7, 2, retained);
  });
  it("does not replace any assignment when a book belongs to another teacher", async () => {
    const repo = makeRepo();
    repo.findAssignedBooks.mockResolvedValue([{ bookId: 21 }]);
    await expect(
      new TeacherAssignmentService(repo as unknown as TeacherAssignmentRepository).saveGrouped(
        7,
        2,
        groups,
        true,
      ),
    ).rejects.toThrow();
    expect(repo.replaceGrouped).not.toHaveBeenCalled();
  });
  it("replaces all teacher rows in one tenant-scoped transaction", async () => {
    const remove = { operation: "delete" },
      insert = { operation: "insert" };
    db.teacherAssignment.deleteMany.mockReturnValue(remove);
    db.teacherAssignment.createMany.mockReturnValue(insert);
    db.$transaction.mockResolvedValue([]);
    await new TeacherAssignmentRepository().replaceGrouped(7, 2, groups);
    expect(db.teacherAssignment.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, teacherId: 2 },
    });
    expect(db.teacherAssignment.createMany).toHaveBeenCalledWith({
      data: [
        { madrasaId: 7, teacherId: 2, classId: 10, bookId: 20 },
        { madrasaId: 7, teacherId: 2, classId: 11, bookId: 21 },
      ],
    });
    expect(db.$transaction).toHaveBeenCalledWith([remove, insert]);
  });
  it("propagates a failed replacement transaction", async () => {
    db.$transaction.mockRejectedValue(new Error("replacement failed"));
    await expect(new TeacherAssignmentRepository().replaceGrouped(7, 2, groups)).rejects.toThrow(
      "replacement failed",
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it("deletes the teacher's assignments only within the current tenant", async () => {
    await new TeacherAssignmentRepository().deleteTeacherAssignments(7, 2);
    expect(db.teacherAssignment.deleteMany).toHaveBeenCalledWith({
      where: { madrasaId: 7, teacherId: 2 },
    });
  });
});
