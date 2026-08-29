import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { env } from "../../shared/config/env";
import { authService } from "./auth.service";

/* =========================================================
   REFRESH TOKEN COOKIE (httpOnly - invisible to frontend JS,
   scoped to /api/auth so it's never attached to unrelated requests)
========================================================= */
const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";
const REFRESH_TOKEN_COOKIE_PATH = "/api/auth";

const setRefreshTokenCookie = (res: Response, rawToken: string) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    // Cross-origin frontend/backend deployments (separate domains) need
    // SameSite=None - only valid paired with Secure, hence gated on
    // production (real HTTPS). Local dev (same-origin-ish, plain HTTP)
    // uses Lax instead.
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: env.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: REFRESH_TOKEN_COOKIE_PATH });
};

/** Browser clients carry the refresh token as an httpOnly cookie; the body
 * field is a fallback for non-browser clients that manage it themselves. */
const getRawRefreshToken = (req: Request): string | undefined =>
  req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;

/* =========================================================
   LOGIN
========================================================= */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const madrasa_id = req.tenant!.madrasa_id;
    const deviceInfo = req.get("user-agent") || null;

    const result = await authService.login({
      email,
      password,
      madrasaId: madrasa_id,
      deviceInfo,
    });

    setRefreshTokenCookie(res, result.refreshToken);
    res.json(result);
  } catch (err) {
    // Original behavior: every login failure - known or unexpected -
    // responds 400 with the error's message.
    const message = err instanceof ApiError ? err.message : (err as Error)?.message;
    res.status(HttpStatus.BAD_REQUEST).json({ message: message || "Login failed" });
  }
};

/* =========================================================
   REFRESH ACCESS TOKEN
========================================================= */
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const rawRefreshToken = getRawRefreshToken(req);
    if (!rawRefreshToken) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: "Refresh token is required" });
      return;
    }
    const deviceInfo = req.get("user-agent") || null;

    const result = await authService.refreshAccessToken(rawRefreshToken, madrasa_id, deviceInfo);

    setRefreshTokenCookie(res, result.refreshToken);
    res.json(result);
  } catch (err) {
    clearRefreshTokenCookie(res);
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });
  }
};

/* =========================================================
   LOGOUT (single session)
========================================================= */
export const logout = async (req: Request, res: Response) => {
  try {
    const rawRefreshToken = getRawRefreshToken(req);
    if (rawRefreshToken) {
      await authService.logout(rawRefreshToken);
    }
  } finally {
    clearRefreshTokenCookie(res);
    res.json({ message: "Logged out" });
  }
};

/* =========================================================
   LOGOUT FROM ALL DEVICES (or all OTHER devices, keeping this one)
========================================================= */
export const logoutAllDevices = async (req: Request, res: Response) => {
  try {
    const keepCurrent = req.body?.keep_current === true;
    const rawRefreshToken = keepCurrent ? getRawRefreshToken(req) : undefined;

    await authService.logoutAllDevices(req.user!.id, rawRefreshToken);

    if (keepCurrent) {
      res.json({ message: "Logged out from other devices" });
      return;
    }
    clearRefreshTokenCookie(res);
    res.json({ message: "Logged out from all devices" });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });
  }
};

/* =========================================================
   REVOKE ONE SESSION
========================================================= */
export const revokeSession = async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    await authService.revokeSession(req.user!.id, sessionId);
    res.json({ message: "Session logged out" });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });
  }
};

/* =========================================================
   LIST ACTIVE SESSIONS (device list shown on the profile page)
========================================================= */
export const listSessions = async (req: Request, res: Response) => {
  try {
    const rawRefreshToken = getRawRefreshToken(req);
    const sessions = await authService.listActiveSessions(req.user!.id, rawRefreshToken);
    res.json({ sessions });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });
  }
};

/* =========================================================
   UNLOCK SCREEN
========================================================= */
export const unlockScreen = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const user_id = req.user!.id;
    const madrasa_id = req.tenant!.madrasa_id;

    await authService.unlockScreen({ userId: user_id, madrasaId: madrasa_id, password });

    res.json({ message: "Unlocked" });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: (err as Error)?.message || "Unlock failed",
    });
  }
};

/* =========================================================
   FORGOT PASSWORD
========================================================= */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const madrasa_id = req.tenant!.madrasa_id;

    const result = await authService.forgotPassword(email, madrasa_id);

    // Same generic message whether or not the email exists.
    res.json({
      message: "If an account with that email exists, a password reset link has been sent.",
      ...(result.devResetToken ? { dev_reset_token: result.devResetToken } : {}),
    });
  } catch (err) {
    const message = err instanceof ApiError ? err.message : (err as Error)?.message;
    res.status(HttpStatus.BAD_REQUEST).json({ message: message || "Request failed" });
  }
};

/* =========================================================
   RESET PASSWORD
========================================================= */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, new_password } = req.body;
    const madrasa_id = req.tenant!.madrasa_id;

    await authService.resetPassword(token, new_password, madrasa_id);

    res.json({ message: "Password has been reset successfully. Please log in." });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: (err as Error)?.message || "Reset failed",
    });
  }
};

/* =========================================================
   MY PROFILE
========================================================= */
export const getMe = async (req: Request, res: Response) => {
  try {
    const profile = await authService.getMe(req.user!.id, req.tenant!.madrasa_id);
    res.json(profile);
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    await authService.updateMe(req.user!.id, req.tenant!.madrasa_id, req.body);
    res.json({ message: "Updated" });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });
  }
};

export const changeMyPassword = async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    await authService.changeMyPassword(
      req.user!.id,
      req.tenant!.madrasa_id,
      current_password,
      new_password,
    );
    res.json({ message: "Password changed" });
  } catch (err) {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });
  }
};
