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

  /** Badge count for the ইহতিমাম > পেন্ডিং sidebar item (see dashboard.repository.ts's
   * identical query for the dashboard stat tile - kept separate per module boundaries). */
  countPendingAdmissions(madrasaId: number) {
    return prisma.student.count({ where: { madrasaId, admissionStatus: "PENDING" } });
  }
}

export const sidebarRepository = new SidebarRepository();
