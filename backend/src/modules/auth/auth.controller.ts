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
