import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { invalidateSessionCache } from "../../shared/auth/sessionStatus";

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

  findMadrasaName(madrasaId: number) {
    return prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { name: true, institutionType: true, defaultLanguage: true },
    });
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
    deviceId?: string | null;
    ipAddress?: string | null;
    city?: string | null;
    country?: string | null;
  }) {
    return prisma.refreshToken.create({ data: { ...data, lastActiveAt: new Date() } });
  }

  /** Refresh-token rotation done in place: the same session row gets a new
   * hash, so the session id (and its login time) stays stable for the whole
   * life of the login while the old raw token stops working. Matching on the
   * old hash makes a concurrent/replayed rotation fail (count 0). */
  rotateRefreshToken(
    id: number,
    oldTokenHash: string,
    data: {
      tokenHash: string;
      expiresAt: Date;
      deviceInfo?: string | null;
      ipAddress?: string | null;
      city?: string | null;
      country?: string | null;
    },
  ) {
    return prisma.refreshToken.updateMany({
      where: { id, tokenHash: oldTokenHash, revokedAt: null },
      data: { ...data, lastActiveAt: new Date() },
    });
  }

  findRefreshTokenById(id: number, userId: number) {
    return prisma.refreshToken.findFirst({ where: { id, userId, revokedAt: null } });
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
      select: {
        id: true,
        tokenHash: true,
        deviceInfo: true,
        ipAddress: true,
        city: true,
        country: true,
        createdAt: true,
        lastActiveAt: true,
        expiresAt: true,
      },
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
    invalidateSessionCache();
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** The "logout from all devices" primitive - revokes every still-valid
   * refresh token for this user, so no session can silently refresh past
   * its current access token's expiry anymore. */
  revokeAllRefreshTokensForUser(userId: number) {
    invalidateSessionCache();
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Same as above but leaves one token (the caller's own current session)
   * alone - "logout from OTHER devices". */
  revokeAllRefreshTokensForUserExcept(userId: number, exceptTokenHash: string) {
    invalidateSessionCache();
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, tokenHash: { not: exceptTokenHash } },
      data: { revokedAt: new Date() },
    });
  }

  /** Same, but keeps one session by row id - a password change logs out
   * every OTHER device while the one that made the change stays signed in. */
  revokeAllRefreshTokensForUserExceptId(userId: number, exceptId: number) {
    invalidateSessionCache();
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, id: { not: exceptId } },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes exactly one session by its row id - scoped to `userId` so a
   * user can only ever revoke their own sessions, never guess another
   * user's session id. */
  revokeRefreshTokenById(id: number, userId: number) {
    invalidateSessionCache();
    return prisma.refreshToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** A device keeps at most one active session - called right before a
   * fresh login issues a new token, so re-logging in on the same device
   * replaces its old session instead of piling up another row. Rows from
   * before device ids existed (deviceId null) are matched by the same
   * User-Agent instead. */
  revokeRefreshTokensForDevice(userId: number, deviceId: string, deviceInfo?: string | null) {
    invalidateSessionCache();
    return prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        OR: [
          { deviceId },
          ...(deviceInfo ? [{ deviceId: null, deviceInfo }] : []),
        ],
      },
      data: { revokedAt: new Date() },
    });
  }

  purgeExpiredRefreshTokens(cutoff: Date = new Date()) {
    return prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  }
}

export const authRepository = new AuthRepository();
