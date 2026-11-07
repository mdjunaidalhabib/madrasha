import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class PlansRepository {
  countListed() {
    return prisma.plan.count({ where: { deletedAt: null } });
  }

  /** The caller holds the catalogue advisory lock. Move one tier and persist
   * contiguous positions for every non-trashed plan, including inactive tiers. */
  private async orderPlans(tx: Prisma.TransactionClient, id?: number, position?: number) {
    const rows = await tx.plan.findMany({
      where: { deletedAt: null }, select: { id: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    if (id !== undefined && position !== undefined) {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) {
        const [moved] = rows.splice(index, 1);
        rows.splice(Math.max(0, Math.min(rows.length, position - 1)), 0, moved);
      }
    }
    for (const [index, row] of rows.entries()) {
      if (row.sortOrder !== index + 1) await tx.plan.update({ where: { id: row.id }, data: { sortOrder: index + 1 } });
    }
  }
  findMany(where: Prisma.PlanWhereInput) {
    return prisma.plan.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameBn: true, tagline: true, taglineBn: true, renewalPrice: true,
        extraStudentPriceFirst: true, extraStudentPriceRenewal: true, sortOrder: true,
        showOnLanding: true, isFeatured: true, accentColor: true,
        studentLimit: true,
        userLimit: true,
        durationDays: true,
        price: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        regBlocks: { select: { divisionId: true, blockSize: true } },
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
        nameBn: true, tagline: true, taglineBn: true, renewalPrice: true,
        extraStudentPriceFirst: true, extraStudentPriceRenewal: true, sortOrder: true,
        showOnLanding: true, isFeatured: true, accentColor: true,
        studentLimit: true,
        userLimit: true,
        durationDays: true,
        price: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        regBlocks: { select: { divisionId: true, blockSize: true } },
      },
      orderBy: { deletedAt: "desc" },
    });
  }

  findActiveByName(name: string) {
    return prisma.plan.findFirst({ where: { name, deletedAt: null }, select: { id: true } });
  }

  findActiveByNameExcludingId(name: string, excludeId: number) {
    return prisma.plan.findFirst({
      where: { name, deletedAt: null, id: { not: excludeId } },
      select: { id: true },
    });
  }

  /** Replaces the plan's per-বিভাগ registration-block sizes. */
  replaceRegBlocks(planId: number, rows: { divisionId: number; blockSize: number }[]) {
    return prisma.$transaction([
      prisma.planDivisionRegBlock.deleteMany({ where: { planId } }),
      prisma.planDivisionRegBlock.createMany({ data: rows.map((r) => ({ planId, ...r })) }),
    ]);
  }

  create(data: Prisma.PlanUncheckedCreateInput) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(731902)`;
      if (data.isFeatured === 1) await tx.plan.updateMany({ data: { isFeatured: 0 }, where: { isFeatured: 1 } });
      const created = await tx.plan.create({ data });
      await this.orderPlans(tx, created.id, data.sortOrder && data.sortOrder > 0 ? data.sortOrder : Number.MAX_SAFE_INTEGER);
      return created;
    });
  }

  updateActiveById(id: number, data: Prisma.PlanUpdateInput) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(731902)`;
      const found = await tx.plan.findFirst({ where: { id, deletedAt: null } });
      if (!found) return { count: 0 };
      if (data.isFeatured === 1) await tx.plan.updateMany({ data: { isFeatured: 0 }, where: { isFeatured: 1, id: { not: id } } });
      // Keep the previous positions until the move is calculated, so other
      // plans preserve their relative order even when positions were duplicated.
      const { sortOrder, ...fields } = data;
      const result = await tx.plan.updateMany({ where: { id, deletedAt: null }, data: fields });
      await this.orderPlans(tx, id, typeof sortOrder === "number" && sortOrder > 0 ? sortOrder : undefined);
      return result;
    });
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
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(731902)`;
      const result = await tx.plan.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
      await this.orderPlans(tx);
      return result;
    });
  }

  restore(id: number) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(731902)`;
      const result = await tx.plan.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
      if (result.count) await this.orderPlans(tx, id, Number.MAX_SAFE_INTEGER);
      return result;
    });
  }

  permanentDelete(id: number) {
    return prisma.plan.deleteMany({ where: { id, deletedAt: { not: null } } });
  }
}

export const plansRepository = new PlansRepository();
