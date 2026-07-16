import { prisma } from "../../shared/database/prisma";

export class AuthRepository {
  findActiveUserByEmail(email: string, madrasaId: number) {
    return prisma.user.findFirst({
      where: { email, madrasaId, isActive: 1 },
    });
  }

  findActiveUserById(userId: number, madrasaId: number) {
    return prisma.user.findFirst({
      where: { id: userId, madrasaId, isActive: 1 },
      select: { passwordHash: true },
    });
  }

  findRoleById(roleId: number) {
    return prisma.role.findUnique({
      where: { id: roleId },
      select: { keyName: true, nameBn: true },
    });
  }

  findRolePermissionKeys(roleId: number) {
    return prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { keyName: true } } },
    });
  }

  findActiveMadrasaModuleKeys(madrasaId: number) {
    return prisma.madrasaModule.findMany({
      where: { madrasaId, isActive: 1 },
      include: { module: { select: { keyName: true } } },
    });
  }
}

export const authRepository = new AuthRepository();
