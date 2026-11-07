import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export const publicPlanSelect = {
  id: true,
  name: true,
  nameBn: true,
  tagline: true,
  taglineBn: true,
  studentLimit: true,
  durationDays: true,
  price: true,
  renewalPrice: true,
  extraStudentPriceFirst: true,
  extraStudentPriceRenewal: true,
  isFeatured: true,
  accentColor: true,
} satisfies Prisma.PlanSelect;

export class PublicPlansRepository {
  findVisible() {
    return prisma.plan.findMany({
      where: { isActive: 1, deletedAt: null, showOnLanding: 1 },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: publicPlanSelect,
    });
  }
}
