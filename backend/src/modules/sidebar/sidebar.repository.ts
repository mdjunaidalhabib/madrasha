import { prisma } from "../../shared/database/prisma";

export class SidebarRepository {
  findRoleById(roleId: number) {
    return prisma.role.findUnique({
      where: { id: roleId },
      select: { keyName: true, nameBn: true },
    });
  }

  findActiveMadrasaModules(madrasaId: number) {
    return prisma.madrasaModule.findMany({
      where: { madrasaId, isActive: 1, module: { isActive: 1 } },
      include: {
        module: {
          select: { id: true, keyName: true, nameBn: true, groupName: true, sortOrder: true },
        },
      },
      orderBy: [{ module: { sortOrder: "asc" } }, { module: { id: "asc" } }],
    });
  }

  findFeaturesByModuleIds(moduleIds: number[]) {
    if (!moduleIds.length) return Promise.resolve([]);
    return prisma.moduleFeature.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { id: true, moduleId: true, keyName: true, nameBn: true, sortOrder: true },
      orderBy: [{ moduleId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
  }
}

export const sidebarRepository = new SidebarRepository();
