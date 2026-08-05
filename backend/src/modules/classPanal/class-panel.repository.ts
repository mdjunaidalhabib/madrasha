import { prisma } from "../../shared/database/prisma";

export class ClassPanelRepository {
  findActiveDivisions(madrasaId: number) {
    return prisma.madrasaDivision.findMany({
      where: { madrasaId, isActive: 1 },
      select: { id: true, sortOrder: true, division: { select: { id: true, nameBn: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  updateDivision(id: number, nameBn: string) {
    return prisma.division.update({ where: { id }, data: { nameBn } });
  }

  async reorderDivisions(madrasaId: number, orderedDivisionIds: number[]) {
    await prisma.$transaction(
      orderedDivisionIds.map((divisionId, index) =>
        prisma.madrasaDivision.updateMany({
          where: { madrasaId, divisionId, isActive: 1 },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  findActiveClassesByDivision(madrasaId: number, divisionId: number) {
    return prisma.madrasaClass.findMany({
      where: { madrasaId, isActive: 1, class: { divisionId } },
      select: { id: true, sortOrder: true, class: { select: { id: true, nameBn: true, divisionId: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findActiveClassForMadrasa(madrasaId: number, classId: number) {
    return prisma.madrasaClass.findFirst({
      where: { madrasaId, classId, isActive: 1 },
      select: { id: true },
    });
  }

  createClass(nameBn: string, divisionId: number) {
    return prisma.class.create({ data: { nameBn, divisionId, isActive: true } });
  }

  async linkClassToMadrasa(madrasaId: number, classId: number, divisionId: number) {
    // Class order is per-tenant (like books), so a newly linked class sorts
    // after this madrasa's current last class in the division, not the
    // shared global catalogue order.
    const last = await prisma.madrasaClass.findFirst({
      where: { madrasaId, isActive: 1, class: { divisionId } },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return prisma.madrasaClass.create({
      data: { madrasaId, classId, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  }

  updateClass(id: number, nameBn: string) {
    return prisma.class.update({ where: { id }, data: { nameBn } });
  }

  deactivateMadrasaClass(madrasaId: number, classId: number) {
    return prisma.madrasaClass.updateMany({
      where: { classId, madrasaId },
      data: { isActive: 0, deletedAt: new Date() },
    });
  }

  deactivateMadrasaDivision(madrasaId: number, divisionId: number) {
    return prisma.madrasaDivision.updateMany({
      where: { divisionId, madrasaId },
      data: { isActive: 0, deletedAt: new Date() },
    });
  }

  async reorderClasses(madrasaId: number, orderedClassIds: number[]) {
    await prisma.$transaction(
      orderedClassIds.map((classId, index) =>
        prisma.madrasaClass.updateMany({
          where: { madrasaId, classId, isActive: 1 },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  findActiveSubjectsByClass(madrasaId: number, classId: number) {
    return prisma.madrasaBook.findMany({
      where: { madrasaId, isActive: 1, book: { classId } },
      select: {
        id: true,
        isMiyari: true,
        fullMark: true,
        sortOrder: true,
        book: { select: { id: true, nameBn: true, classId: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { book: { id: "asc" } }],
    });
  }

  updateSubjectFullMark(madrasaId: number, bookId: number, fullMark: number) {
    return prisma.madrasaBook.updateMany({
      where: { madrasaId, bookId, isActive: 1 },
      data: { fullMark },
    });
  }

  async reorderSubjects(madrasaId: number, orderedBookIds: number[]) {
    await prisma.$transaction(
      orderedBookIds.map((bookId, index) =>
        prisma.madrasaBook.updateMany({
          where: { madrasaId, bookId, isActive: 1 },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  setMiyariSubjects(madrasaId: number, classId: number, bookIds: number[]) {
    return prisma.$transaction([
      prisma.madrasaBook.updateMany({
        where: { madrasaId, isActive: 1, book: { classId } },
        data: { isMiyari: false },
      }),
      prisma.madrasaBook.updateMany({
        where: {
          madrasaId,
          isActive: 1,
          bookId: { in: bookIds },
          book: { classId },
        },
        data: { isMiyari: true },
      }),
    ]);
  }

  createAndLinkSubject(madrasaId: number, nameBn: string, classId: number) {
    return prisma.$transaction(async (tx) => {
      const lastSubject = await tx.madrasaBook.findFirst({
        where: { madrasaId, isActive: 1, book: { classId } },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      const book = await tx.book.create({ data: { nameBn, classId } });
      await tx.madrasaBook.create({
        data: { madrasaId, bookId: book.id, sortOrder: (lastSubject?.sortOrder ?? -1) + 1 },
      });
      return book;
    });
  }

  findSubjectForMadrasa(madrasaId: number, bookId: number) {
    return prisma.madrasaBook.findFirst({
      where: { madrasaId, bookId, isActive: 1 },
      select: { book: { select: { id: true, classId: true, nameBn: true } } },
    });
  }

  updateSubjectForMadrasa(madrasaId: number, bookId: number, nameBn: string) {
    return prisma.$transaction(async (tx) => {
      const link = await tx.madrasaBook.findFirst({
        where: { madrasaId, bookId, isActive: 1 },
        select: {
          id: true,
          book: { select: { id: true, classId: true, name: true, nameBn: true } },
        },
      });

      if (!link?.book) return null;

      const tenantLinkCount = await tx.madrasaBook.count({ where: { bookId } });

      // The seeded Book catalogue may be shared by several madrasas. A
      // tenant editing a subject must not rename it for every other tenant,
      // so shared subjects use copy-on-write and the current madrasa's
      // dependent marks/teacher assignments are moved to the private copy.
      if (tenantLinkCount > 1) {
        const privateBook = await tx.book.create({
          data: {
            classId: link.book.classId,
            // `Book` has a global unique constraint on (classId, name).
            // Keep the tenant copy's English catalogue key null so cloning
            // a shared seeded subject cannot collide with the original.
            name: null,
            nameBn,
          },
        });

        await tx.madrasaBook.update({
          where: { id: link.id },
          data: { bookId: privateBook.id },
        });
        await tx.mark.updateMany({
          where: { madrasaId, bookId },
          data: { bookId: privateBook.id },
        });
        await tx.teacherAssignment.updateMany({
          where: { madrasaId, bookId },
          data: { bookId: privateBook.id },
        });

        return privateBook;
      }

      return tx.book.update({ where: { id: bookId }, data: { nameBn } });
    });
  }

  countSubjectMarks(madrasaId: number, bookId: number) {
    return prisma.mark.count({
      where: { madrasaId, bookId },
    });
  }

  // Marks are deliberately preserved here — deleting a subject only moves it
  // to Trash. Marks are only ever hard-deleted if the book is permanently
  // deleted from Trash (see trash.repository.ts#permanentDeleteBook).
  deactivateSubject(madrasaId: number, bookId: number) {
    return prisma.madrasaBook.updateMany({
      where: { bookId, madrasaId },
      data: { isActive: 0, deletedAt: new Date() },
    });
  }
}

export const classPanelRepository = new ClassPanelRepository();
