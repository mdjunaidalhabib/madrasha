import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { guardianService } from "./guardian.service";
import { logger } from "../../shared/logger/logger";
import { t } from "../../shared/i18n";

export const resetStudentGuardianPassword = async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const data = await guardianService.resetPasswordForStudent(req.tenant!.madrasa_id, Number(req.params.id), req.user!.id);
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).json({ success: false, message: error.message });
    logger.error("GUARDIAN PASSWORD RESET FAILED", error);
    return res.status(500).json({ success: false, message: t({ bn: "পাসওয়ার্ড রিসেট করা যায়নি। আবার চেষ্টা করুন।", en: "Could not reset password. Please try again." }) });
  }
};
