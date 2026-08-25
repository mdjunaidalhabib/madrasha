import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class EventRepository {
  findMany(madrasaId: number) {
    return prisma.event.findMany({
      where: { madrasaId },
      orderBy: [{ eventDate: "desc" }, { id: "desc" }],
    });
  }

  findUpcoming(madrasaId: number, fromDate: Date, limit: number) {
    return prisma.event.findMany({
      where: { madrasaId, eventDate: { gte: fromDate } },
      orderBy: { eventDate: "asc" },
      take: limit,
    });
  }

  findById(id: number, madrasaId: number) {
    return prisma.event.findFirst({ where: { id, madrasaId } });
  }

  create(madrasaId: number, data: Omit<Prisma.EventUncheckedCreateInput, "madrasaId">) {
    return prisma.event.create({ data: { ...data, madrasaId } });
  }

  update(id: number, madrasaId: number, data: Prisma.EventUpdateInput) {
    return prisma.event.updateMany({ where: { id, madrasaId }, data });
  }

  delete(id: number, madrasaId: number) {
    return prisma.event.deleteMany({ where: { id, madrasaId } });
  }
}

export const eventRepository = new EventRepository();
