import { prisma } from "../../shared/database/prisma";

export class ClassPanelRepository {
  findActiveDivisions(madrasaId: number) {
    return prisma.madrasaDivision.findMany({
      where: { madrasaId, isActive: 1 },
      select: { division: { select: { id: true, nameBn: true } } },
    });
  }

  findActiveClassesByDivision(madrasaId: number, divisionId: number) {
    return prisma.madrasaClass.findMany({
      where: { madrasaId, isActive: 1, class: { divisionId } },
      select: { class: { select: { id: true, nameBn: true, divisionId: true, sortOrder: true } } },
      orderBy: { class: { sortOrder: "asc" } },
    });
  }

  findActiveClassForMadrasa(madrasaId: number, classId: number) {
    return prisma.madrasaClass.findFirst({
      where: { madrasaId, classId, isActive: 1 },
      select: { id: true },
    });
  }

  createClass(nameBn: string, divisionId: number) {
    // Custom, madrasha-added classes sort after the seeded master list
    // (which uses low sortOrder numbers) unless reordered later.
    return prisma.class.create({ data: { nameBn, divisionId, isActive: true, sortOrder: 9999 } });
  }

  linkClassToMadrasa(madrasaId: number, classId: number) {
    return prisma.madrasaClass.create({ data: { madrasaId, classId } });
  }

  updateClass(id: number, nameBn: string) {
    return prisma.class.update({ where: { id }, data: { nameBn } });
  }

  deactivateMadrasaClass(madrasaId: number, classId: number) {
    return prisma.madrasaClass.updateMany({
      where: { classId, madrasaId },
      data: { isActive: 0 },
    });
  }

  findActiveSubjectsByClass(madrasaId: number, classId: number) {
    return prisma.madrasaBook.findMany({
      where: { madrasaId, isActive: 1, book: { classId } },
      select: {
        id: true,
        isMiyari: true,
        book: { select: { id: true, nameBn: true, classId: true } },
      },
      orderBy: { book: { id: "asc" } },
    });
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
      const book = await tx.book.create({ data: { nameBn, classId } });
      await tx.madrasaBook.create({ data: { madrasaId, bookId: book.id } });
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

  deactivateSubjectAndRemoveMarks(madrasaId: number, bookId: number) {
    return prisma.$transaction([
      prisma.mark.deleteMany({ where: { madrasaId, bookId } }),
      prisma.madrasaBook.updateMany({
        where: { bookId, madrasaId },
        data: { isActive: 0 },
      }),
    ]);
  }
}

export const classPanelRepository = new ClassPanelRepository();
