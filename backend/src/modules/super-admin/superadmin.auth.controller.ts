import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { superAdminAuthService } from "./superadmin.auth.service";

export const superAdminLogin = async (req: Request, res: Response) => {
  try {
    const result = await superAdminAuthService.login(req.body);
    res.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    logger.error("Super admin login failed:", err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Super admin login failed" });
  }
};
