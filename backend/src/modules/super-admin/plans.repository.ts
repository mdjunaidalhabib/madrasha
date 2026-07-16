import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class PlansRepository {
  findMany(where: Prisma.PlanWhereInput) {
    return prisma.plan.findMany({
      where,
      select: {
        id: true,
        name: true,
        studentLimit: true,
        userLimit: true,
        durationDays: true,
        price: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "desc" },
    });
  }

  findTrashed() {
    return prisma.plan.findMany({
      where: { deletedAt: { not: null } },
      select: {
        id: true,
        name: true,
        studentLimit: true,
        userLimit: true,
        durationDays: true,
        price: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { deletedAt: "desc" },
    });
  }

  findActiveByName(name: string) {
    return prisma.plan.findFirst({ where: { name, deletedAt: null }, select: { id: true } });
  }

  create(data: Prisma.PlanUncheckedCreateInput) {
    return prisma.plan.create({ data });
  }

  updateActiveById(id: number, data: Prisma.PlanUpdateInput) {
    return prisma.plan.updateMany({ where: { id, deletedAt: null }, data });
  }

  findActiveById(id: number) {
    return prisma.plan.findFirst({ where: { id, deletedAt: null } });
  }

  updateById(id: number, data: Prisma.PlanUpdateInput) {
    return prisma.plan.update({ where: { id }, data });
  }

  countRunningSubscriptions(planId: number) {
    return prisma.madrasaSubscription.count({
      where: {
        planId,
        isActive: 1,
        OR: [{ endDate: null }, { endDate: { gte: new Date(new Date().toDateString()) } }],
      },
    });
  }

  softDelete(id: number) {
    return prisma.plan.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }

  restore(id: number) {
    return prisma.plan.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
  }

  permanentDelete(id: number) {
    return prisma.plan.deleteMany({ where: { id, deletedAt: { not: null } } });
  }
}

export const plansRepository = new PlansRepository();
