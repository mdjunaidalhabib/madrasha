import crypto from "crypto";
import { comparePassword, hashPassword } from "../../shared/utils/hash.util";
import { generateToken } from "../../shared/utils/jwt.util";
import { NotFoundError, BadRequestError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { env } from "../../shared/config/env";
import { buildInstitutionInfo } from "../../shared/utils/institution.util";
import { lookupIpLocation } from "../../shared/utils/geoip.util";
import {
  SECURITY_ACTIONS,
  SessionClient,
  deviceLines,
  logSecurityEvent,
  userLine,
} from "./auth.activity";
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
import { t } from "../../shared/i18n";
import { logActivity } from "../../shared/utils/activity.util";
import { USER_ACTIVITY_ENTITY } from "../users/user.constants";

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
    deviceId,
    ipAddress,
  }: LoginCredentials): Promise<LoginResult> {
    const user = await this.repository.findActiveUserByEmail(email, madrasaId);
    // Location for the security log of a failed attempt (a successful login
    // gets it from issueRefreshToken below).
    const failedClient = async (): Promise<SessionClient> => ({
      deviceInfo,
      ipAddress,
      ...(await lookupIpLocation(ipAddress)),
    });
    if (!user) {
      await logSecurityEvent({
        madrasaId,
        userId: null,
        action: SECURITY_ACTIONS.LOGIN_FAILED,
        lines: [`ইমেইল: ${email}`, "কারণ: এই ইমেইলে কোনো সক্রিয় অ্যাকাউন্ট নেই", ...deviceLines(await failedClient())],
      });
      throw new BadRequestError(t({ bn: "ইমেইল বা পাসওয়ার্ড সঠিক নয়", en: "Invalid credentials" }));
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new BadRequestError(t({ bn: `অনেকবার ভুল চেষ্টা হয়েছে। ${minutesLeft} মিনিট পর আবার চেষ্টা করুন।`, en: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` }));
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

      await logSecurityEvent({
        madrasaId,
        userId: user.id,
        action: lockedUntil ? SECURITY_ACTIONS.ACCOUNT_LOCKED : SECURITY_ACTIONS.LOGIN_FAILED,
        lines: [
          userLine(user),
          lockedUntil
            ? `কারণ: পরপর ${attempts} বার ভুল পাসওয়ার্ড — অ্যাকাউন্ট ${ACCOUNT_LOCKOUT_DURATION_MS / 60000} মিনিটের জন্য লক করা হয়েছে`
            : `কারণ: ভুল পাসওয়ার্ড (${attempts}/${MAX_FAILED_LOGIN_ATTEMPTS} বার)`,
          ...deviceLines(await failedClient()),
        ],
      });

      if (lockedUntil) {
        logger.warn(`Account locked after ${attempts} failed logins`, { userId: user.id });
        throw new BadRequestError(
          t({ bn: `অনেকবার ভুল চেষ্টা হয়েছে। অ্যাকাউন্টটি ${ACCOUNT_LOCKOUT_DURATION_MS / 60000} মিনিটের জন্য লক করা হয়েছে।`, en: `Too many failed attempts. Account locked for ${ACCOUNT_LOCKOUT_DURATION_MS / 60000} minutes.` }),
        );
      }
      throw new BadRequestError(t({ bn: "ইমেইল বা পাসওয়ার্ড সঠিক নয়", en: "Invalid credentials" }));
    }

    await this.repository.recordSuccessfulLogin(user.id);

    const roleKey = normalizeRoleKey(role?.keyName || role?.nameBn);
    const [permissions, modules, madrasa] = await Promise.all([
      this.resolvePermissions(user.roleId, roleKey),
      this.resolveEnabledModules(user.madrasaId),
      this.repository.findMadrasaName(user.madrasaId),
    ]);

    if (deviceId) {
      await this.repository.revokeRefreshTokensForDevice(user.id, deviceId, deviceInfo);
    }
    const session = await this.issueRefreshToken(user.id, user.madrasaId, {
      deviceInfo,
      deviceId,
      ipAddress,
    });
    const refreshToken = session.rawToken;
    await logSecurityEvent({
      madrasaId: user.madrasaId,
      userId: user.id,
      action: SECURITY_ACTIONS.LOGIN,
      lines: [userLine(user), ...deviceLines({ deviceInfo, ipAddress, ...session.location })],
    });
    const token = generateToken({
      id: user.id,
      madrasa_id: user.madrasaId,
      role_id: user.roleId,
      role: roleKey,
      sid: session.id,
    });

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
      madrasa_name: madrasa?.name || "",
      institution: buildInstitutionInfo(madrasa),
    };
  }

  /* ================= REFRESH TOKEN / SESSIONS ================= */

  /** Random opaque token (not a JWT - it's only ever used as a DB lookup
   * key, so there's nothing to encode/verify statelessly). Same raw+hash
   * pattern as forgotPassword()'s reset token. */
  private async issueRefreshToken(
    userId: number,
    madrasaId: number,
    client: { deviceInfo?: string | null; deviceId?: string | null; ipAddress?: string | null },
  ): Promise<{ id: number; rawToken: string; location: { city: string | null; country: string | null } }> {
    const { rawToken, tokenHash, expiresAt } = this.newRefreshTokenValues();
    const location = await lookupIpLocation(client.ipAddress);

    const row = await this.repository.createRefreshToken({
      madrasaId,
      userId,
      tokenHash,
      expiresAt,
      deviceInfo: client.deviceInfo,
      deviceId: client.deviceId,
      ipAddress: client.ipAddress,
      ...location,
    });

    return { id: row.id, rawToken, location };
  }

  private newRefreshTokenValues() {
    const rawToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + env.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
    );
    return { rawToken, tokenHash, expiresAt };
  }

  /** Verifies a refresh token and rotates it: the session row gets a new
   * token and the old one stops working ("refresh token rotation") - so a stolen-and-reused-once token can't be replayed
   * indefinitely in parallel with the legitimate session. */
  async refreshAccessToken(
    rawRefreshToken: string,
    madrasaId: number,
    deviceInfo?: string | null,
    ipAddress?: string | null,
  ): Promise<RefreshTokenResult> {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const tokenRow = await this.repository.findValidRefreshToken(tokenHash);
    if (!tokenRow || tokenRow.madrasaId !== madrasaId) {
      throw new BadRequestError(t({ bn: "রিফ্রেশ টোকেন সঠিক নয় বা মেয়াদোত্তীর্ণ", en: "Invalid or expired refresh token" }));
    }

    const user = await this.repository.findActiveUserForRefresh(tokenRow.userId, madrasaId);
    if (!user) {
      await this.repository.revokeRefreshToken(tokenHash);
      throw new BadRequestError(t({ bn: "রিফ্রেশ টোকেন সঠিক নয় বা মেয়াদোত্তীর্ণ", en: "Invalid or expired refresh token" }));
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.repository.revokeRefreshToken(tokenHash);
      throw new BadRequestError(t({ bn: "অ্যাকাউন্টটি লক করা আছে", en: "Account is locked" }));
    }

    const next = this.newRefreshTokenValues();
    const location =
      ipAddress && ipAddress !== tokenRow.ipAddress
        ? await lookupIpLocation(ipAddress)
        : { city: tokenRow.city, country: tokenRow.country };
    const rotated = await this.repository.rotateRefreshToken(tokenRow.id, tokenHash, {
      tokenHash: next.tokenHash,
      expiresAt: next.expiresAt,
      deviceInfo: deviceInfo ?? tokenRow.deviceInfo,
      ipAddress: ipAddress ?? tokenRow.ipAddress,
      ...location,
    });
    if (!rotated.count) {
      throw new BadRequestError(t({ bn: "রিফ্রেশ টোকেন সঠিক নয় বা মেয়াদোত্তীর্ণ", en: "Invalid or expired refresh token" }));
    }
    const refreshToken = next.rawToken;

    const roleKey = normalizeRoleKey(user.role?.keyName || user.role?.nameBn);
    const token = generateToken({
      id: user.id,
      madrasa_id: madrasaId,
      role_id: user.roleId,
      role: roleKey,
      sid: tokenRow.id,
    });

    return { token, refreshToken };
  }

  /** Logs out a single session/device - revokes just this refresh token. */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const row = await this.repository.findValidRefreshToken(tokenHash);
    await this.repository.revokeRefreshToken(tokenHash);
    if (row) {
      await logSecurityEvent({
        madrasaId: row.madrasaId,
        userId: row.userId,
        action: SECURITY_ACTIONS.LOGOUT,
        lines: [
          userLine(await this.repository.findMyProfile(row.userId, row.madrasaId)),
          ...deviceLines(row),
        ],
      });
    }
  }

  /** "From: <device> · <place>" line for an action done on the device list. */
  private async actorDeviceLines(client: SessionClient): Promise<string[]> {
    const location = client.city || client.country ? {} : await lookupIpLocation(client.ipAddress);
    return deviceLines({ ...client, ...location }).map((line) =>
      line.startsWith("ডিভাইস: ") ? `যে ডিভাইস থেকে করা হয়েছে: ${line.slice(8)}` : line,
    );
  }

  /** "Logout from all devices" - revokes every refresh token this user has.
   * When `exceptRawRefreshToken` (this browser's own cookie) is passed, that
   * one session is left alone instead - "logout from OTHER devices", the
   * user stays signed in here. */
  async logoutAllDevices(
    userId: number,
    madrasaId: number,
    client: SessionClient,
    exceptRawRefreshToken?: string,
  ): Promise<void> {
    let result: { count: number };
    if (exceptRawRefreshToken) {
      const exceptTokenHash = crypto
        .createHash("sha256")
        .update(exceptRawRefreshToken)
        .digest("hex");
      result = await this.repository.revokeAllRefreshTokensForUserExcept(userId, exceptTokenHash);
    } else {
      result = await this.repository.revokeAllRefreshTokensForUser(userId);
    }

    await logSecurityEvent({
      madrasaId,
      userId,
      action: exceptRawRefreshToken ? SECURITY_ACTIONS.LOGOUT_OTHERS : SECURITY_ACTIONS.LOGOUT_ALL,
      lines: [
        userLine(await this.repository.findMyProfile(userId, madrasaId)),
        `লগআউট হওয়া ডিভাইস: ${result.count} টি`,
        ...(await this.actorDeviceLines(client)),
      ],
    });
  }

  /** Revokes exactly one session (e.g. clicked from the device list) -
   * scoped to `userId` so a user can only revoke their own sessions. */
  async revokeSession(
    userId: number,
    madrasaId: number,
    sessionId: number,
    client: SessionClient,
  ): Promise<void> {
    const row = await this.repository.findRefreshTokenById(sessionId, userId);
    const result = await this.repository.revokeRefreshTokenById(sessionId, userId);
    if (!row || !result.count) throw new NotFoundError(t({ bn: "সেশন পাওয়া যায়নি", en: "Session not found" }));

    const user = await this.repository.findMyProfile(userId, madrasaId);
    const isOwnDevice = Boolean(client.deviceId && row.deviceId === client.deviceId);
    await logSecurityEvent({
      madrasaId,
      userId,
      action: isOwnDevice ? SECURITY_ACTIONS.LOGOUT : SECURITY_ACTIONS.LOGOUT_DEVICE,
      lines: isOwnDevice
        ? [userLine(user), ...deviceLines(row)]
        : [
            userLine(user),
            ...deviceLines(row).map((line) =>
              line.startsWith("ডিভাইস: ") ? `লগআউট করা ডিভাইস: ${line.slice(8)}` : line,
            ),
            ...(await this.actorDeviceLines(client)),
          ],
    });
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
      ip_address: row.ipAddress,
      city: row.city,
      country: row.country,
      created_at: row.createdAt,
      last_active_at: row.lastActiveAt,
      expires_at: row.expiresAt,
      is_current: currentTokenHash !== null && row.tokenHash === currentTokenHash,
    }));
  }

  async unlockScreen({ userId, madrasaId, password }: UnlockCredentials): Promise<void> {
    const user = await this.repository.findActiveUserById(userId, madrasaId);
    if (!user) {
      throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found" }));
    }

    const validPassword = await comparePassword(password, user.passwordHash);
    if (!validPassword) {
      throw new BadRequestError(t({ bn: "পাসওয়ার্ড সঠিক নয়", en: "Invalid password" }));
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
    const base = env.adminBaseUrl || `https://${env.rootDomain}`;
    const resetLink = `${base}/reset-password?token=${rawToken}&slug=${madrasa?.slug || ""}`;

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
      throw new BadRequestError(t({ bn: "এই রিসেট লিংকটি সঠিক নয় বা মেয়াদোত্তীর্ণ", en: "This reset link is invalid or has expired" }));
    }

    const passwordHash = await hashPassword(newPassword);
    await this.repository.updateUserPasswordHash(resetToken.userId, passwordHash);
    await this.repository.markResetTokenUsed(resetToken.id);
    // A password reset means any earlier session may have been compromised
    // (that's why a reset was needed) - kill every refresh token so a
    // leaked old session can't keep silently refreshing past this point.
    await this.repository.revokeAllRefreshTokensForUser(resetToken.userId);

    const user = await this.repository.findMyProfile(resetToken.userId, madrasaId);
    await logActivity({
      madrasa_id: madrasaId,
      user_id: resetToken.userId,
      action: "UPDATE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: resetToken.userId,
      details: [
        `ইউজার: ${user?.name ?? `আইডি ${resetToken.userId}`}${user?.email ? ` (${user.email})` : ""}`,
        "ইমেইলের রিসেট লিংক দিয়ে পাসওয়ার্ড পরিবর্তন করা হয়েছে",
      ].join("\n"),
    });
  }

  /* ================= MY PROFILE ================= */

  /** Also returns fresh permissions/modules (not just profile fields) so the
   * frontend can re-sync useAuthStore's access snapshot on every app load
   * (see DashboardLayout.tsx) instead of only at login - otherwise a module
   * split, or a role's permissions being edited, only takes effect for an
   * already-logged-in user after they explicitly log out and back in. */
  async getMe(userId: number, madrasaId: number): Promise<MyProfile> {
    const user = await this.repository.findMyProfile(userId, madrasaId);
    if (!user) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found" }));

    const roleKey = normalizeRoleKey(user.role?.keyName || user.role?.nameBn);
    const [permissions, modules, madrasa] = await Promise.all([
      this.resolvePermissions(user.roleId, roleKey),
      this.resolveEnabledModules(madrasaId),
      this.repository.findMadrasaName(madrasaId),
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
      institution: buildInstitutionInfo(madrasa),
    };
  }

  async updateMe(userId: number, madrasaId: number, dto: UpdateMyProfileInput): Promise<void> {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestError(t({ bn: "নাম আবশ্যক", en: "Name is required" }));
      data.name = dto.name.trim();
    }
    if (dto.mobile !== undefined) data.mobile = dto.mobile.trim() || null;
    if (dto.photo_url !== undefined) data.photoUrl = dto.photo_url.trim() || null;

    if (!Object.keys(data).length) throw new BadRequestError(t({ bn: "আপডেট করার মতো কোনো সঠিক তথ্য নেই", en: "No valid data to update" }));

    const before = await this.repository.findMyProfile(userId, madrasaId);
    const result = await this.repository.updateMyProfile(userId, madrasaId, data as any);
    if (!result.count) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found" }));

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "UPDATE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: userId,
      details: [
        `নিজের প্রোফাইল হালনাগাদ: ${before?.name ?? `আইডি ${userId}`}`,
        ...(data.name !== undefined && data.name !== before?.name ? [`নাম: ${before?.name ?? "—"} → ${data.name}`] : []),
        ...(data.mobile !== undefined && data.mobile !== before?.mobile ? [`মোবাইল: ${before?.mobile ?? "—"} → ${data.mobile ?? "—"}`] : []),
        ...(data.photoUrl !== undefined && data.photoUrl !== before?.photoUrl ? ["ছবি পরিবর্তন করা হয়েছে"] : []),
      ].join("\n"),
    });
  }

  /** Re-confirms the CURRENT user's own password without changing anything
   * - a lightweight step-up check for a sensitive in-app action (e.g. "রিসেট"
   * wiping a whole class's marks) that doesn't warrant a full re-login, but
   * still shouldn't go through on a click alone. Throws the same generic
   * message on a wrong password as on "user not found", so this can't be
   * used to probe whether an id exists. */
  async verifyMyPassword(userId: number, madrasaId: number, password: string): Promise<void> {
    const user = await this.repository.findPasswordHashById(userId, madrasaId);
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw new BadRequestError(t({ bn: "পাসওয়ার্ড সঠিক নয়।", en: "Incorrect password." }));
    }
  }

  async changeMyPassword(
    userId: number,
    madrasaId: number,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: number,
  ): Promise<void> {
    const user = await this.repository.findPasswordHashById(userId, madrasaId);
    if (!user) throw new NotFoundError(t({ bn: "ব্যবহারকারী পাওয়া যায়নি", en: "User not found" }));

    const validPassword = await comparePassword(currentPassword, user.passwordHash);
    if (!validPassword) throw new BadRequestError(t({ bn: "বর্তমান পাসওয়ার্ড সঠিক নয়", en: "Current password is incorrect" }));

    const passwordHash = await hashPassword(newPassword);
    await this.repository.updateUserPasswordHash(userId, passwordHash);
    // Same reasoning as resetPassword(): a fresh password should invalidate
    // any session that might have been riding on the old one - except the
    // device making the change, which stays signed in (as Gmail does).
    const revoked = currentSessionId
      ? await this.repository.revokeAllRefreshTokensForUserExceptId(userId, currentSessionId)
      : await this.repository.revokeAllRefreshTokensForUser(userId);

    await logActivity({
      madrasa_id: madrasaId,
      user_id: userId,
      action: "UPDATE",
      entity: USER_ACTIVITY_ENTITY,
      entity_id: userId,
      details: [
        "নিজের পাসওয়ার্ড পরিবর্তন করা হয়েছে",
        ...(revoked.count ? [`অন্য ডিভাইস লগআউট করা হয়েছে: ${revoked.count} টি`] : []),
      ].join("\n"),
    });
  }
}

export const authService = new AuthService();
