import { Request, Response } from "express";
import { ApiError } from "../../shared/errors";
import { HttpStatus } from "../../shared/constants";
import { logger } from "../../shared/logger/logger";
import { asyncHandler } from "../../shared/utils/async-handler.util";
import { userService } from "./user.service";
import { t } from "../../shared/i18n";

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const rows = await userService.listUsers(madrasa_id);
  res.json(rows);
});

export const createUser = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const id = await userService.createUser(madrasa_id, req.user!.id, req.body);
    res.json({ message: t({ bn: "ব্যবহারকারী তৈরি হয়েছে", en: "User created" }), id });
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

  res.json({ message: t({ bn: "মুছে ফেলা হয়েছে", en: "Deleted" }) });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const id = Number(req.params.id);

  await userService.updateUser(madrasa_id, req.user!.id, id, req.body);

  res.json({ message: t({ bn: "আপডেট হয়েছে", en: "Updated" }) });
});

export const resetUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const id = Number(req.params.id);

  await userService.adminResetPassword(madrasa_id, req.user!.id, id, req.body);

  res.json({ message: t({ bn: "পাসওয়ার্ড রিসেট হয়েছে", en: "Password reset" }) });
});

export const unlockUserAccount = asyncHandler(async (req: Request, res: Response) => {
  const madrasa_id = req.tenant!.madrasa_id;
  const id = Number(req.params.id);

  await userService.adminUnlockAccount(madrasa_id, req.user!.id, id);

  res.json({ message: t({ bn: "অ্যাকাউন্ট আনলক করা হয়েছে", en: "Account unlocked" }) });
});
