import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { userService } from "./user.service";

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const rows = await userService.listUsers(madrasa_id);
  res.json(rows);
});

export const createUser = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const id = await userService.createUser(madrasa_id, req.user!.id, req.body);
    res.json({ message: "User created", id });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    logger.error("CREATE USER ERROR:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (error as Error)?.message });
  }
};

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const id = Number(req.params.id);

  await userService.deleteUser(madrasa_id, req.user!.id, id);

  res.json({ message: "Deleted" });
});
