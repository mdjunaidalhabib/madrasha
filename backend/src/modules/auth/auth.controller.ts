import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { authService } from "./auth.service";

/* =========================================================
   LOGIN
========================================================= */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const madrasa_id = req.tenant!.madrasa_id;

    const result = await authService.login({ email, password, madrasaId: madrasa_id });

    res.json(result);
  } catch (err) {
    // Original behavior: every login failure - known or unexpected -
    // responds 400 with the error's message.
    const message = err instanceof ApiError ? err.message : (err as Error)?.message;
    res.status(HttpStatus.BAD_REQUEST).json({ message: message || "Login failed" });
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
