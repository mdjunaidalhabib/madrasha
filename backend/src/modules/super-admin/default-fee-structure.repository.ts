import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class DefaultFeeStructureRepository {
  findMany(classId?: number) {
    return prisma.defaultFeeStructure.findMany({
      where: classId ? { classId } : undefined,
      select: {
        id: true,
        classId: true,
        name: true,
        amount: true,
        frequency: true,
        isActive: true,
        class: { select: { nameBn: true, division: { select: { nameBn: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findById(id: number) {
    return prisma.defaultFeeStructure.findUnique({ where: { id } });
  }

  create(data: Prisma.DefaultFeeStructureUncheckedCreateInput) {
    return prisma.defaultFeeStructure.create({ data });
  }

  update(id: number, data: Prisma.DefaultFeeStructureUpdateInput) {
    return prisma.defaultFeeStructure.update({ where: { id }, data });
  }

  delete(id: number) {
    return prisma.defaultFeeStructure.delete({ where: { id } });
  }
}

export const defaultFeeStructureRepository = new DefaultFeeStructureRepository();
