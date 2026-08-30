import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { studentProfileService } from "./student-profile.service";

export const getStudentProfile360 = async (req: Request, res: Response) => {
  try {
    const madrasaId = req.tenant!.madrasa_id;
    const studentId = Number(req.params.id);
    const data = await studentProfileService.getProfile360(studentId, madrasaId);
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    logger.error("GET STUDENT PROFILE 360 ERROR:", error);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: (error as Error)?.message || "Something went wrong" });
  }
};
