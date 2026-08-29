import { Prisma } from "@prisma/client";
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

  createResetToken(data: {
    madrasaId: number;
    userId: number;
    tokenHash: string;
    expiresAt: Date;
  }) {
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

  /* ================= MY PROFILE ================= */

  findMyProfile(userId: number, madrasaId: number) {
    return prisma.user.findFirst({
      where: { id: userId, madrasaId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        photoUrl: true,
        roleId: true,
        role: { select: { keyName: true, nameBn: true } },
      },
    });
  }

  findPasswordHashById(userId: number, madrasaId: number) {
    return prisma.user.findFirst({
      where: { id: userId, madrasaId },
      select: { passwordHash: true },
    });
  }

  updateMyProfile(userId: number, madrasaId: number, data: Prisma.UserUncheckedUpdateInput) {
    return prisma.user.updateMany({ where: { id: userId, madrasaId }, data });
  }

  /* ================= REFRESH TOKENS ================= */

  createRefreshToken(data: {
    madrasaId: number;
    userId: number;
    tokenHash: string;
    expiresAt: Date;
    deviceInfo?: string | null;
  }) {
    return prisma.refreshToken.create({ data });
  }

  findValidRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  /** Every still-valid session for this user - powers the "logout from all
   * devices" confirmation modal's device list. tokenHash is selected only
   * so the caller can flag which row is the current browser's own session;
   * it never leaves the service layer. */
  findActiveRefreshTokensForUser(userId: number) {
    return prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, tokenHash: true, deviceInfo: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Looks up the user a refresh token belongs to, re-checking the same
   * active/madrasa conditions login() enforces - a user deactivated (or
   * moved) after issuing the token must not be able to silently refresh
   * their way back to a valid access token. */
  findActiveUserForRefresh(userId: number, madrasaId: number) {
    return prisma.user.findFirst({
      where: { id: userId, madrasaId, isActive: 1 },
      select: {
        id: true,
        madrasaId: true,
        roleId: true,
        lockedUntil: true,
        role: { select: { keyName: true, nameBn: true } },
      },
    });
  }

  revokeRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** The "logout from all devices" primitive - revokes every still-valid
   * refresh token for this user, so no session can silently refresh past
   * its current access token's expiry anymore. */
  revokeAllRefreshTokensForUser(userId: number) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Same as above but leaves one token (the caller's own current session)
   * alone - "logout from OTHER devices". */
  revokeAllRefreshTokensForUserExcept(userId: number, exceptTokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, tokenHash: { not: exceptTokenHash } },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes exactly one session by its row id - scoped to `userId` so a
   * user can only ever revoke their own sessions, never guess another
   * user's session id. */
  revokeRefreshTokenById(id: number, userId: number) {
    return prisma.refreshToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  purgeExpiredRefreshTokens(cutoff: Date = new Date()) {
    return prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  }
}

export const authRepository = new AuthRepository();
