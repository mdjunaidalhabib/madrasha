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

  findBooks(classId?: number) {
    return prisma.book.findMany({
      where: classId ? { classId } : undefined,
      select: { id: true, name: true, nameBn: true, classId: true },
      orderBy: { id: "asc" },
    });
  }
}

export const metaRepository = new MetaRepository();
