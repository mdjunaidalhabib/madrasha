import { prisma } from "../../shared/database/prisma";

export class TeacherAssignmentRepository {
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
        book: { select: { nameBn: true } },
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
