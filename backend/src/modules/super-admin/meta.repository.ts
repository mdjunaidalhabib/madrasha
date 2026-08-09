import { prisma } from "../../shared/database/prisma";

export class MetaRepository {
  findDivisions() {
    return prisma.division.findMany({
      select: { id: true, keyName: true, name: true, nameBn: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findDivisionByNameBn(nameBn: string) {
    return prisma.division.findFirst({ where: { nameBn } });
  }

  findMaxDivisionSortOrder() {
    return prisma.division.aggregate({ _max: { sortOrder: true } });
  }

  createDivision(data: { name: string | null; nameBn: string; sortOrder: number }) {
    return prisma.division.create({ data });
  }

  updateDivision(id: number, nameBn: string) {
    return prisma.division.update({ where: { id }, data: { nameBn } });
  }

  deleteDivision(id: number) {
    return prisma.division.delete({ where: { id } });
  }

  findAllDivisionIds() {
    return prisma.division.findMany({ select: { id: true } });
  }

  async reorderDivisions(orderedDivisionIds: number[]) {
    await prisma.$transaction(
      orderedDivisionIds.map((id, index) => prisma.division.update({ where: { id }, data: { sortOrder: index } })),
    );
  }

  findActiveModules() {
    return prisma.moduleDef.findMany({
      where: { isActive: 1 },
      select: { id: true, keyName: true, name: true, nameBn: true, groupName: true },
      orderBy: [{ groupName: "asc" }, { id: "asc" }],
    });
  }

  findClasses(divisionId?: number, includeInactive = false) {
    return prisma.class.findMany({
      where: {
        ...(divisionId ? { divisionId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: { id: true, name: true, nameBn: true, divisionId: true, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findMaxClassSortOrder(divisionId: number) {
    return prisma.class.aggregate({ where: { divisionId }, _max: { sortOrder: true } });
  }

  createClass(data: { divisionId: number; name: string | null; nameBn: string; sortOrder: number }) {
    return prisma.class.create({ data });
  }

  updateClass(id: number, nameBn: string) {
    return prisma.class.update({ where: { id }, data: { nameBn } });
  }

  toggleClassActive(id: number, isActive: boolean) {
    return prisma.class.update({ where: { id }, data: { isActive } });
  }

  deleteClass(id: number) {
    return prisma.class.delete({ where: { id } });
  }

  findClassIdsByDivision(divisionId: number) {
    return prisma.class.findMany({ where: { divisionId }, select: { id: true } });
  }

  async reorderClasses(divisionId: number, orderedClassIds: number[]) {
    await prisma.$transaction(
      orderedClassIds.map((id, index) =>
        prisma.class.updateMany({ where: { id, divisionId }, data: { sortOrder: index } }),
      ),
    );
  }

  findBooks(classId?: number) {
    return prisma.book.findMany({
      where: classId ? { classId } : undefined,
      select: { id: true, name: true, nameBn: true, classId: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findBookByNameBn(classId: number, nameBn: string) {
    return prisma.book.findFirst({ where: { classId, nameBn } });
  }

  findMaxBookSortOrder(classId: number) {
    return prisma.book.aggregate({ where: { classId }, _max: { sortOrder: true } });
  }

  createBook(data: { classId: number; name: string | null; nameBn: string; sortOrder: number }) {
    return prisma.book.create({ data });
  }

  updateBook(id: number, nameBn: string) {
    return prisma.book.update({ where: { id }, data: { nameBn } });
  }

  deleteBook(id: number) {
    return prisma.book.delete({ where: { id } });
  }

  findBookIdsByClass(classId: number) {
    return prisma.book.findMany({ where: { classId }, select: { id: true } });
  }

  async reorderBooks(classId: number, orderedBookIds: number[]) {
    await prisma.$transaction(
      orderedBookIds.map((id, index) =>
        prisma.book.updateMany({ where: { id, classId }, data: { sortOrder: index } }),
      ),
    );
  }
}

export const metaRepository = new MetaRepository();
