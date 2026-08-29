import crypto from "crypto";
import { comparePassword, hashPassword } from "../../shared/utils/hash.util";
import { generateToken } from "../../shared/utils/jwt.util";
import { NotFoundError, BadRequestError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { env } from "../../shared/config/env";
import { emailService } from "../../shared/notifications/email.service";
import { authRepository, AuthRepository } from "./auth.repository";
import {
  ActiveSession,
  LoginCredentials,
  LoginResult,
  MyProfile,
  RefreshTokenResult,
  UnlockCredentials,
  UpdateMyProfileInput,
} from "./auth.types";
import {
  MUHTAMIM_ROLE_KEYS,
  MUHTAMIM_BASELINE_PERMISSIONS,
  PASSWORD_RESET_TOKEN_TTL_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  ACCOUNT_LOCKOUT_DURATION_MS,
} from "./auth.constants";

const normalizeRoleKey = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

export class AuthService {
  constructor(private readonly repository: AuthRepository = authRepository) {}

  async login({
    email,
    password,
    madrasaId,
    deviceInfo,
  }: LoginCredentials): Promise<LoginResult> {
    const user = await this.repository.findActiveUserByEmail(email, madrasaId);
    if (!user) {
      throw new BadRequestError("Invalid credentials");
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new BadRequestError(`Too many failed attempts. Try again in ${minutesLeft} minute(s).`);
    }

    const [role, validPassword] = await Promise.all([
      this.repository.findRoleById(user.roleId),
      comparePassword(password, user.passwordHash),
    ]);
    if (!validPassword) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        attempts >= MAX_FAILED_LOGIN_ATTEMPTS
          ? new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS)
          : null;
      await this.repository.recordFailedLogin(user.id, attempts, lockedUntil);

      if (lockedUntil) {
        logger.warn(`Account locked after ${attempts} failed logins`, { userId: user.id });
        throw new BadRequestError(
          `Too many failed attempts. Account locked for ${ACCOUNT_LOCKOUT_DURATION_MS / 60000} minutes.`,
        );
      }
      throw new BadRequestError("Invalid credentials");
    }

    await this.repository.recordSuccessfulLogin(user.id);

    const roleKey = normalizeRoleKey(role?.keyName || role?.nameBn);
    const [permissions, modules] = await Promise.all([
      this.resolvePermissions(user.roleId, roleKey),
      this.resolveEnabledModules(user.madrasaId),
    ]);

    const token = generateToken({
      id: user.id,
      madrasa_id: user.madrasaId,
      role_id: user.roleId,
      role: roleKey,
    });
    const refreshToken = await this.issueRefreshToken(user.id, user.madrasaId, deviceInfo);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role_id: user.roleId,
        role_key: roleKey,
        role_label: role?.nameBn || "",
        mobile: user.mobile,
        photo_url: user.photoUrl,
      },
      permissions,
      modules,
    };
  }

  /* ================= REFRESH TOKEN / SESSIONS ================= */

  /** Random opaque token (not a JWT - it's only ever used as a DB lookup
   * key, so there's nothing to encode/verify statelessly). Same raw+hash
   * pattern as forgotPassword()'s reset token. */
  private async issueRefreshToken(
    userId: number,
    madrasaId: number,
    deviceInfo?: string | null,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + env.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
    );

    await this.repository.createRefreshToken({
      madrasaId,
      userId,
      tokenHash,
      expiresAt,
      deviceInfo,
    });

    return rawToken;
  }

  /** Verifies a refresh token and rotates it: the old one is revoked and a
   * new one issued alongside the new access token ("refresh token
   * rotation") - so a stolen-and-reused-once token can't be replayed
   * indefinitely in parallel with the legitimate session. */
  async refreshAccessToken(
    rawRefreshToken: string,
    madrasaId: number,
    deviceInfo?: string | null,
  ): Promise<RefreshTokenResult> {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const tokenRow = await this.repository.findValidRefreshToken(tokenHash);
    if (!tokenRow || tokenRow.madrasaId !== madrasaId) {
      throw new BadRequestError("Invalid or expired refresh token");
    }

    const user = await this.repository.findActiveUserForRefresh(tokenRow.userId, madrasaId);
    if (!user) {
      await this.repository.revokeRefreshToken(tokenHash);
      throw new BadRequestError("Invalid or expired refresh token");
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.repository.revokeRefreshToken(tokenHash);
      throw new BadRequestError("Account is locked");
    }

    await this.repository.revokeRefreshToken(tokenHash);
    const refreshToken = await this.issueRefreshToken(user.id, madrasaId, deviceInfo);

    const roleKey = normalizeRoleKey(user.role?.keyName || user.role?.nameBn);
    const token = generateToken({
      id: user.id,
      madrasa_id: madrasaId,
      role_id: user.roleId,
      role: roleKey,
    });

    return { token, refreshToken };
  }

  /** Logs out a single session/device - revokes just this refresh token. */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    await this.repository.revokeRefreshToken(tokenHash);
  }

  /** "Logout from all devices" - revokes every refresh token this user has.
   * When `exceptRawRefreshToken` (this browser's own cookie) is passed, that
   * one session is left alone instead - "logout from OTHER devices", the
   * user stays signed in here. */
  async logoutAllDevices(userId: number, exceptRawRefreshToken?: string): Promise<void> {
    if (exceptRawRefreshToken) {
      const exceptTokenHash = crypto
        .createHash("sha256")
        .update(exceptRawRefreshToken)
        .digest("hex");
      await this.repository.revokeAllRefreshTokensForUserExcept(userId, exceptTokenHash);
      return;
    }
    await this.repository.revokeAllRefreshTokensForUser(userId);
  }

  /** Revokes exactly one session (e.g. clicked from the device list) -
   * scoped to `userId` so a user can only revoke their own sessions. */
  async revokeSession(userId: number, sessionId: number): Promise<void> {
    const result = await this.repository.revokeRefreshTokenById(sessionId, userId);
    if (!result.count) throw new NotFoundError("Session not found");
  }

  /** Lists this user's still-valid sessions (for the "logout from all
   * devices" confirmation modal) - `currentRawRefreshToken` (this browser's
   * own cookie, if present) is hashed and matched so the UI can flag it. */
  async listActiveSessions(
    userId: number,
    currentRawRefreshToken?: string,
  ): Promise<ActiveSession[]> {
    const currentTokenHash = currentRawRefreshToken
      ? crypto.createHash("sha256").update(currentRawRefreshToken).digest("hex")
      : null;

    const rows = await this.repository.findActiveRefreshTokensForUser(userId);

    return rows.map((row) => ({
      id: row.id,
      device_info: row.deviceInfo,
      created_at: row.createdAt,
      expires_at: row.expiresAt,
      is_current: currentTokenHash !== null && row.tokenHash === currentTokenHash,
    }));
  }

  async unlockScreen({ userId, madrasaId, password }: UnlockCredentials): Promise<void> {
    const user = await this.repository.findActiveUserById(userId, madrasaId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const validPassword = await comparePassword(password, user.passwordHash);
    if (!validPassword) {
      throw new BadRequestError("Invalid password");
    }
  }

  /** Loads DB-seeded role permissions and adds the baseline grants certain roles get implicitly. */
  private async resolvePermissions(roleId: number, roleKey: string): Promise<string[]> {
    const rolePermissions = await this.repository.findRolePermissionKeys(roleId);
    const dbPermissions = rolePermissions
      .map((rp) => rp.permission.keyName)
      .filter((k): k is string => Boolean(k));

    const permissionSet = new Set<string>(dbPermissions);

    if ((MUHTAMIM_ROLE_KEYS as readonly string[]).includes(roleKey)) {
      MUHTAMIM_BASELINE_PERMISSIONS.forEach((permission) => permissionSet.add(permission));
    }

    return Array.from(permissionSet);
  }

  private async resolveEnabledModules(madrasaId: number): Promise<string[]> {
    const madrasaModules = await this.repository.findActiveMadrasaModuleKeys(madrasaId);
    return madrasaModules.map((mm) => mm.module.keyName).filter((k): k is string => Boolean(k));
  }

  /* ================= FORGOT / RESET PASSWORD ================= */

  /**
   * Issues a one-time reset token if the email matches an active user.
   * Deliberately does not reveal whether the email exists (same generic
   * message either way) to avoid leaking which emails are registered.
   *
   * NOTE: there is no email/SMS service wired up yet (see Phase 4). Until
   * one exists, the raw reset link is logged server-side, and — only
   * outside production — also returned in the API response so the flow
   * is testable end-to-end without a mail provider.
   */
  async forgotPassword(email: string, madrasaId: number): Promise<{ devResetToken?: string }> {
    const user = await this.repository.findActiveUserByEmailAnyRole(email, madrasaId);
    if (!user) {
      // Same response as the success path - don't leak account existence.
      return {};
    }

    await this.repository.invalidateExistingResetTokens(user.id);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await this.repository.createResetToken({
      madrasaId,
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const madrasa = await this.repository.findMadrasaSlug(madrasaId);
    const base = env.frontendBaseUrl || `https://${env.rootDomain}`;
    const resetLink = `${base}/${madrasa?.slug || ""}/admin/reset-password?token=${rawToken}`;

    const emailResult = await emailService.send({
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <p>Hi ${user.name || ""},</p>
        <p>Someone requested a password reset for your account. If this was you, click the link below (valid for 1 hour):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
      text: `Reset your password: ${resetLink} (valid for 1 hour). If you didn't request this, ignore this email.`,
    });

    if (!emailResult.success) {
      // Don't leak the failure to the caller (still return the generic
      // message) - but log it loudly so an admin/dev notices SMTP is
      // broken rather than guardians silently never getting the email.
      logger.error(
        `Failed to send password-reset email to ${user.email}`,
        emailResult.errorMessage,
      );
    }

    if (env.nodeEnv !== "production") {
      return { devResetToken: rawToken };
    }
    return {};
  }

  async resetPassword(rawToken: string, newPassword: string, madrasaId: number): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const resetToken = await this.repository.findValidResetToken(tokenHash);
    if (!resetToken || resetToken.madrasaId !== madrasaId) {
      throw new BadRequestError("This reset link is invalid or has expired");
    }

    const passwordHash = await hashPassword(newPassword);
    await this.repository.updateUserPasswordHash(resetToken.userId, passwordHash);
    await this.repository.markResetTokenUsed(resetToken.id);
    // A password reset means any earlier session may have been compromised
    // (that's why a reset was needed) - kill every refresh token so a
    // leaked old session can't keep silently refreshing past this point.
    await this.repository.revokeAllRefreshTokensForUser(resetToken.userId);
  }

  /* ================= MY PROFILE ================= */

  /** Also returns fresh permissions/modules (not just profile fields) so the
   * frontend can re-sync useAuthStore's access snapshot on every app load
   * (see DashboardLayout.tsx) instead of only at login - otherwise a module
   * split, or a role's permissions being edited, only takes effect for an
   * already-logged-in user after they explicitly log out and back in. */
  async getMe(userId: number, madrasaId: number): Promise<MyProfile> {
    const user = await this.repository.findMyProfile(userId, madrasaId);
    if (!user) throw new NotFoundError("User not found");

    const roleKey = normalizeRoleKey(user.role?.keyName || user.role?.nameBn);
    const [permissions, modules] = await Promise.all([
      this.resolvePermissions(user.roleId, roleKey),
      this.resolveEnabledModules(madrasaId),
    ]);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      photo_url: user.photoUrl,
      role_key: roleKey,
      role_label: user.role?.nameBn || "",
      permissions,
      modules,
    };
  }

  async updateMe(userId: number, madrasaId: number, dto: UpdateMyProfileInput): Promise<void> {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestError("Name is required");
      data.name = dto.name.trim();
    }
    if (dto.mobile !== undefined) data.mobile = dto.mobile.trim() || null;
    if (dto.photo_url !== undefined) data.photoUrl = dto.photo_url.trim() || null;

    if (!Object.keys(data).length) throw new BadRequestError("No valid data to update");

    const result = await this.repository.updateMyProfile(userId, madrasaId, data as any);
    if (!result.count) throw new NotFoundError("User not found");
  }

  async changeMyPassword(
    userId: number,
    madrasaId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.repository.findPasswordHashById(userId, madrasaId);
    if (!user) throw new NotFoundError("User not found");

    const validPassword = await comparePassword(currentPassword, user.passwordHash);
    if (!validPassword) throw new BadRequestError("Current password is incorrect");

    const passwordHash = await hashPassword(newPassword);
    await this.repository.updateUserPasswordHash(userId, passwordHash);
    // Same reasoning as resetPassword(): a fresh password should invalidate
    // any session that might have been riding on the old one.
    await this.repository.revokeAllRefreshTokensForUser(userId);
  }
}

export const authService = new AuthService();
