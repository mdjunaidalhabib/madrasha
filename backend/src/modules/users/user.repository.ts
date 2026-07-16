import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class UserRepository {
  findManyForTenant(madrasaId: number) {
    return prisma.user.findMany({
      where: { madrasaId },
      select: { id: true, name: true, email: true, roleId: true, isActive: true },
      orderBy: { id: "desc" },
    });
  }

  findMadrasaUserLimit(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { userLimit: true },
    });
  }

  countActiveForTenant(madrasaId: number) {
    return prisma.user.count({ where: { madrasaId, isActive: 1 } });
  }

  create(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({ data });
  }

  deleteManyForTenant(id: number, madrasaId: number) {
    return prisma.user.deleteMany({ where: { id, madrasaId } });
  }
}

export const userRepository = new UserRepository();
