import { Request, Response } from "express";
import { logger } from "../../shared/logger/logger";
import { HttpStatus } from "../../shared/constants";
import { sidebarService } from "./sidebar.service";
import { subscribeSidebarChanges } from "./sidebar.events";

export const streamSidebarChanges = (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const send = (event: string) => {
    if (res.destroyed || res.writableEnded) return;
    res.write(`event: ${event}\ndata: {}\n\n`);
    res.flush?.();
  };
  const unsubscribe = subscribeSidebarChanges(req.tenant!.madrasa_id, () => send("changed"));
  send("ready");
  const heartbeat = setInterval(() => send("heartbeat"), 15000);
  const expiry = setTimeout(() => res.end(), 60000);
  res.on("close", () => {
    clearInterval(heartbeat);
    clearTimeout(expiry);
    unsubscribe();
  });
};

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
