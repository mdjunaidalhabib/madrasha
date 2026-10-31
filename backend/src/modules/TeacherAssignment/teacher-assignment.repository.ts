import { prisma } from "../../shared/database/prisma";

export class TeacherAssignmentRepository {
  findTeacher(madrasaId: number, teacherId: number) {
    return prisma.teacher.findFirst({
      where: { id: teacherId, madrasaId, deletedAt: null },
      select: { id: true },
    });
  }

  findAssignedBooks(madrasaId: number, bookIds: number[], excludeTeacherId?: number) {
    return prisma.teacherAssignment.findMany({
      where: {
        madrasaId,
        bookId: { in: bookIds },
        ...(excludeTeacherId ? { teacherId: { not: excludeTeacherId } } : {}),
      },
      select: { bookId: true },
    });
  }

  replaceGrouped(
    madrasaId: number,
    teacherId: number,
    groups: Array<{ class_id: number; book_ids: number[] }>,
  ) {
    return prisma.$transaction([
      prisma.teacherAssignment.deleteMany({ where: { madrasaId, teacherId } }),
      prisma.teacherAssignment.createMany({
        data: groups.flatMap((group) =>
          group.book_ids.map((bookId) => ({
            madrasaId,
            teacherId,
            classId: group.class_id,
            bookId,
          })),
        ),
      }),
    ]);
  }

  deleteTeacherAssignments(madrasaId: number, teacherId: number) {
    return prisma.teacherAssignment.deleteMany({ where: { madrasaId, teacherId } });
  }

  createGrouped(
    madrasaId: number,
    teacherId: number,
    groups: Array<{ class_id: number; book_ids: number[] }>,
  ) {
    // One insert is atomic, including when selections span several classes.
    return prisma.teacherAssignment.createMany({
      data: groups.flatMap((group) =>
        group.book_ids.map((bookId) => ({ madrasaId, teacherId, classId: group.class_id, bookId })),
      ),
    });
  }

  async getCatalog(madrasaId: number) {
    const [classes, books] = await Promise.all([
      prisma.madrasaClass.findMany({
        where: { madrasaId, isActive: 1, deletedAt: null },
        select: {
          nameBn: true,
          class: { select: { id: true, name: true, nameBn: true, divisionId: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.madrasaBook.findMany({
        where: { madrasaId, isActive: 1, deletedAt: null },
        select: { book: { select: { id: true, name: true, nameBn: true, classId: true } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
    ]);
    const classIds = new Set(classes.map((row) => row.class.id));
    return {
      classes: classes.map((row) => ({
        class_id: row.class.id,
        class_name_bn: row.nameBn || row.class.nameBn || row.class.name || `#${row.class.id}`,
        division_id: row.class.divisionId,
      })),
      books: books
        .filter((row) => classIds.has(row.book.classId))
        .map((row) => ({
          book_id: row.book.id,
          book_name_bn: row.book.nameBn || row.book.name || `#${row.book.id}`,
          class_id: row.book.classId,
        })),
    };
  }

  replaceBooks(madrasaId: number, teacherId: number, classId: number, bookIds: number[]) {
    // Both writes commit together so a failed update cannot erase the previous assignment.
    return prisma.$transaction([
      prisma.teacherAssignment.deleteMany({ where: { madrasaId, teacherId, classId } }),
      prisma.teacherAssignment.createMany({
        data: bookIds.map((bookId) => ({ madrasaId, teacherId, classId, bookId })),
      }),
    ]);
  }

  findBookIds(madrasaId: number, teacherId: number, classId: number) {
    return prisma.teacherAssignment.findMany({
      where: { madrasaId, teacherId, classId },
      select: { bookId: true },
    });
  }

  findAllForTenant(madrasaId: number) {
    return prisma.teacherAssignment.findMany({
      where: { madrasaId },
      select: {
        classId: true,
        bookId: true,
        teacher: { select: { id: true, nameBn: true } },
        book: { select: { nameBn: true, name: true } },
      },
      orderBy: { teacherId: "asc" },
    });
  }

  countForTeacher(madrasaId: number, teacherId: number) {
    return prisma.teacherAssignment.count({ where: { madrasaId, teacherId } });
  }

  createMany(madrasaId: number, teacherId: number, classId: number, bookIds: number[]) {
    return prisma.teacherAssignment.createMany({
      data: bookIds.map((bookId) => ({ madrasaId, teacherId, classId, bookId })),
    });
  }

  deleteMany(madrasaId: number, teacherId: number, classId: number) {
    return prisma.teacherAssignment.deleteMany({ where: { madrasaId, teacherId, classId } });
  }
}

export const teacherAssignmentRepository = new TeacherAssignmentRepository();
