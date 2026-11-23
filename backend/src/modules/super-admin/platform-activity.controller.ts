import type { Request, Response, NextFunction } from "express";
import { listPlatformActivities } from "./platform-activity.repository";

function dateBoundary(value: unknown, end = false): Date | undefined {
  if (!value) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("তারিখ সঠিক নয়");
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+06:00`);
  if (!Number.isFinite(date.getTime()) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(date) !== value) throw new Error("তারিখ সঠিক নয়");
  return date;
}

export async function getPlatformActivities(req: Request, res: Response, next: NextFunction) {
  let from: Date | undefined, to: Date | undefined;
  try {
    from = dateBoundary(req.query.from); to = dateBoundary(req.query.to, true);
    if (from && to && from > to) throw new Error("শুরুর তারিখ শেষের তারিখের পরে হতে পারে না");
  } catch (error) { res.status(400).json({ message: (error as Error).message }); return; }
  const positive = (value: unknown, fallback: number, max: number) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback;
  };
  try {
    res.json(await listPlatformActivities({ page: positive(req.query.page, 1, 1000000), limit: positive(req.query.limit, 25, 100),
      search: typeof req.query.search === "string" ? req.query.search : undefined, from, to }));
  } catch (error) { next(error); }
}
