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
      select: { book: { select: { id: true, nameBn: true, classId: true } } },
    });
  }

  createSubject(nameBn: string, classId: number) {
    return prisma.book.create({ data: { nameBn, classId } });
  }

  linkSubjectToMadrasa(madrasaId: number, bookId: number) {
    return prisma.madrasaBook.create({ data: { madrasaId, bookId } });
  }

  updateSubject(id: number, nameBn: string) {
    return prisma.book.update({ where: { id }, data: { nameBn } });
  }

  deactivateMadrasaSubject(madrasaId: number, bookId: number) {
    return prisma.madrasaBook.updateMany({
      where: { bookId, madrasaId },
      data: { isActive: 0 },
    });
  }
}

export const classPanelRepository = new ClassPanelRepository();
