import { prisma } from "../../shared/database/prisma";

export class MetaRepository {
  findDivisions() {
    return prisma.division.findMany({
      select: { id: true, keyName: true, name: true, nameBn: true },
      orderBy: { id: "asc" },
    });
  }

  findActiveModules() {
    return prisma.moduleDef.findMany({
      where: { isActive: 1 },
      select: { id: true, keyName: true, name: true, nameBn: true, groupName: true },
      orderBy: [{ groupName: "asc" }, { id: "asc" }],
    });
  }

  findClasses(divisionId?: number) {
    return prisma.class.findMany({
      where: divisionId ? { divisionId } : undefined,
      select: { id: true, name: true, nameBn: true, divisionId: true },
      orderBy: { id: "asc" },
    });
  }

  findBooks(classId?: number) {
    return prisma.book.findMany({
      where: classId ? { classId } : undefined,
      select: { id: true, name: true, nameBn: true, classId: true },
      orderBy: { id: "asc" },
    });
  }
}

export const metaRepository = new MetaRepository();
