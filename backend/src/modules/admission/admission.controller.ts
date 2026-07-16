import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { admissionService } from "./admission.service";

export const createAdmission = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant?.madrasa_id;
    const studentId = await admissionService.admit(req.body, madrasaId);

    return res.status(HttpStatus.CREATED).json({
      success: true,
      message: "Student admitted successfully",
      studentId,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    logger.error("ADMISSION ERROR:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Admission failed",
      error: (error as Error)?.message,
    });
  }
};
