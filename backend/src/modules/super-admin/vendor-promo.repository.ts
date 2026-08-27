import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class VendorPromoRepository {
  findConfig() {
    return prisma.platformVendorPromo.findFirst({ orderBy: { id: "asc" } });
  }

  async upsertConfig(data: Prisma.PlatformVendorPromoUncheckedUpdateInput) {
    const existing = await this.findConfig();
    if (existing) {
      return prisma.platformVendorPromo.update({ where: { id: existing.id }, data });
    }
    return prisma.platformVendorPromo.create({
      data: data as Prisma.PlatformVendorPromoUncheckedCreateInput,
    });
  }

  findServices() {
    return prisma.platformVendorService.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  }

  findActiveServices() {
    return prisma.platformVendorService.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findServiceById(id: number) {
    return prisma.platformVendorService.findUnique({ where: { id } });
  }

  findMaxServiceSortOrder() {
    return prisma.platformVendorService.aggregate({ _max: { sortOrder: true } });
  }

  createService(data: Prisma.PlatformVendorServiceUncheckedCreateInput) {
    return prisma.platformVendorService.create({ data });
  }

  updateService(id: number, data: Prisma.PlatformVendorServiceUpdateInput) {
    return prisma.platformVendorService.update({ where: { id }, data });
  }

  deleteService(id: number) {
    return prisma.platformVendorService.delete({ where: { id } });
  }

  findAllServiceIds() {
    return prisma.platformVendorService.findMany({ select: { id: true } });
  }

  async reorderServices(orderedIds: number[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.platformVendorService.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
  }
}

export const vendorPromoRepository = new VendorPromoRepository();
