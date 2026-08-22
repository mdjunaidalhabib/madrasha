import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class UserRepository {
  findManyForTenant(madrasaId: number) {
    return prisma.user.findMany({
      where: { madrasaId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        photoUrl: true,
        roleId: true,
        isActive: true,
        lastLoginAt: true,
        lockedUntil: true,
        role: { select: { keyName: true } },
      },
      orderBy: { id: "desc" },
    });
  }

  findByIdForTenant(id: number, madrasaId: number) {
    return prisma.user.findFirst({
      where: { id, madrasaId },
      select: { id: true, role: { select: { keyName: true } } },
    });
  }

  updatePasswordHash(id: number, madrasaId: number, passwordHash: string) {
    return prisma.user.updateMany({ where: { id, madrasaId }, data: { passwordHash } });
  }

  resetLockAndAttempts(id: number, madrasaId: number) {
    return prisma.user.updateMany({
      where: { id, madrasaId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
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

  updateManyForTenant(id: number, madrasaId: number, data: Prisma.UserUncheckedUpdateInput) {
    return prisma.user.updateMany({ where: { id, madrasaId }, data });
  }

  findRoleForTenant(roleId: number, madrasaId: number) {
    return prisma.role.findFirst({ where: { id: roleId, madrasaId } });
  }
}

export const userRepository = new UserRepository();
