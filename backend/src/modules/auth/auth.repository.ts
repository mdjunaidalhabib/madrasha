import { prisma } from "../../shared/database/prisma";

export class AuthRepository {
  findActiveUserByEmail(email: string, madrasaId: number) {
    return prisma.user.findFirst({
      where: { email, madrasaId, isActive: 1 },
    });
  }

  recordFailedLogin(userId: number, failedLoginAttempts: number, lockedUntil: Date | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts, lockedUntil },
    });
  }

  recordSuccessfulLogin(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
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

  /* ================= FORGOT / RESET PASSWORD ================= */

  findActiveUserByEmailAnyRole(email: string, madrasaId: number) {
    return prisma.user.findFirst({
      where: { email, madrasaId, isActive: 1 },
      select: { id: true, name: true, email: true },
    });
  }

  findMadrasaSlug(madrasaId: number) {
    return prisma.madrasa.findUnique({ where: { id: madrasaId }, select: { slug: true } });
  }

  /** Invalidates any earlier, still-usable reset tokens for this user
   * before issuing a new one, so only the most recent link ever works. */
  invalidateExistingResetTokens(userId: number) {
    return prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  createResetToken(data: { madrasaId: number; userId: number; tokenHash: string; expiresAt: Date }) {
    return prisma.passwordResetToken.create({ data });
  }

  findValidResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  markResetTokenUsed(id: number) {
    return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  updateUserPasswordHash(userId: number, passwordHash: string) {
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}

export const authRepository = new AuthRepository();
