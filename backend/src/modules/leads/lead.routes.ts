import { Router, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { superAdminMiddleware } from "../../shared/middleware/superAdmin.middleware";
import { createLeadSchema, updateLeadSchema, leadStatuses } from "./lead.validation";

const router = Router();
const handle = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
router.post("/public/leads", rateLimit({
  windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false,
  message: { message: "অনেকবার চেষ্টা করেছেন। কিছুক্ষণ পরে আবার চেষ্টা করুন। / Please try again later." },
}), handle(async (req, res) => {
  const parsed = createLeadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "সঠিক তথ্য ও মোবাইল নম্বর দিন। / Please check your details.", errors: parsed.error.flatten().fieldErrors }); return; }
  const { consent, website, ...data } = parsed.data;
  // Serialize same-phone submissions, including concurrent retries. Do not reveal existing lead data.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.phone}))`;
    const existing = await tx.platformLead.findFirst({ where: { phone: data.phone, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
    if (!existing) await tx.platformLead.create({ data });
  });
  res.status(201).json({ message: "আপনার অনুরোধ পেয়েছি। / Your request has been received." });
}));

router.get("/super/leads/summary", superAdminMiddleware, handle(async (_req, res) => {
  const now = new Date();
  const day = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(now) + "T00:00:00+06:00");
  const groupedCounts = prisma.platformLead.groupBy({ by: ["status"], orderBy: { status: "asc" }, _count: { _all: true } });
  const [groups, today, due, recent] = await prisma.$transaction([
    groupedCounts,
    prisma.platformLead.count({ where: { createdAt: { gte: day } } }),
    prisma.platformLead.count({ where: { followUpAt: { lte: now }, status: { notIn: ["CONVERTED", "LOST"] } } }),
    prisma.platformLead.findMany({ take: 5, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
  ]);
  const counts = Object.fromEntries(leadStatuses.map((status) => [status, groups.find((g) => g.status === status)?._count._all || 0]));
  res.json({ data: { counts, total: groups.reduce((sum, g) => sum + g._count._all, 0), today, due, recent } });
}));
router.get("/super/leads", superAdminMiddleware, handle(async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const search = String(req.query.search || "").trim().slice(0, 180);
  const status = String(req.query.status || "");
  if (status && !leadStatuses.includes(status as typeof leadStatuses[number])) { res.status(400).json({ message: "Invalid status" }); return; }
  const where: Prisma.PlatformLeadWhereInput = {
    ...(status ? { status: status as typeof leadStatuses[number] } : {}),
    ...(req.query.due === "true" ? { followUpAt: { lte: new Date() }, status: { notIn: ["CONVERTED", "LOST"] } } : {}),
    ...(search ? { OR: ["name", "phone", "institution", "utmCampaign", "utmSource"].map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.platformLead.findMany({ where, skip: (page - 1) * 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    prisma.platformLead.count({ where }),
  ]);
  res.json({ data, total, page, pageSize: 20 });
}));
router.patch("/super/leads/:id", superAdminMiddleware, handle(async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateLeadSchema.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) { res.status(400).json({ message: "Invalid lead update" }); return; }
  const result = await prisma.platformLead.updateMany({ where: { id }, data: parsed.data });
  if (!result.count) { res.status(404).json({ message: "Lead not found" }); return; }
  res.json({ message: "Lead updated" });
}));
export default router;
