import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class ImportantLinkRepository {
  findMany() {
    return prisma.importantLink.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findActive() {
    return prisma.importantLink.findMany({
      where: { isActive: true },
      select: { id: true, label: true, subLabel: true, url: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findById(id: number) {
    return prisma.importantLink.findUnique({ where: { id } });
  }

  findMaxSortOrder() {
    return prisma.importantLink.aggregate({ _max: { sortOrder: true } });
  }

  create(data: Prisma.ImportantLinkUncheckedCreateInput) {
    return prisma.importantLink.create({ data });
  }

  update(id: number, data: Prisma.ImportantLinkUpdateInput) {
    return prisma.importantLink.update({ where: { id }, data });
  }

  delete(id: number) {
    return prisma.importantLink.delete({ where: { id } });
  }

  findAllIds() {
    return prisma.importantLink.findMany({ select: { id: true } });
  }

  async reorder(orderedIds: number[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) => prisma.importantLink.update({ where: { id }, data: { sortOrder: index } })),
    );
  }
}

export const importantLinkRepository = new ImportantLinkRepository();
