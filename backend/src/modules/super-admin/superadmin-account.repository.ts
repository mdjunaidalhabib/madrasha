import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class SuperAdminAccountRepository {
  findAllActive() {
    return prisma.superAdmin.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  findByEmail(email: string) {
    return prisma.superAdmin.findFirst({ where: { email, deletedAt: null } });
  }

  findById(id: number) {
    return prisma.superAdmin.findFirst({ where: { id, deletedAt: null } });
  }

  countActive() {
    return prisma.superAdmin.count({ where: { deletedAt: null, isActive: 1 } });
  }

  create(data: Prisma.SuperAdminUncheckedCreateInput) {
    return prisma.superAdmin.create({ data });
  }

  setActive(id: number, isActive: number) {
    return prisma.superAdmin.update({ where: { id }, data: { isActive } });
  }
}

export const superAdminAccountRepository = new SuperAdminAccountRepository();
