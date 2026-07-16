import { Request, Response } from "express";
import { logger } from "../../shared/logger/logger";
import { HttpStatus } from "../../shared/constants";
import { sidebarService } from "./sidebar.service";

export const getSidebar = async (req: Request, res: Response) => {
  try {
    const madrasa_id = req.tenant!.madrasa_id;
    const sidebar = await sidebarService.getSidebarTree(madrasa_id, req.user?.role_id);
    res.json(sidebar);
  } catch (err) {
    logger.error("Sidebar error:", err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: (err as Error)?.message });
  }
};
