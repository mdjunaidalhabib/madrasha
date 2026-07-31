import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class NotificationRepository {
  create(data: Prisma.NotificationLogUncheckedCreateInput) {
    return prisma.notificationLog.create({ data });
  }

  markSent(id: number, provider: string) {
    return prisma.notificationLog.update({
      where: { id },
      data: { status: "SENT", provider, sentAt: new Date() },
    });
  }

  markFailed(id: number, provider: string, errorMessage: string) {
    return prisma.notificationLog.update({
      where: { id },
      data: { status: "FAILED", provider, errorMessage },
    });
  }

  findMany(madrasaId: number, where: Prisma.NotificationLogWhereInput, limit: number) {
    return prisma.notificationLog.findMany({
      where: { madrasaId, ...where },
      orderBy: { id: "desc" },
      take: limit,
    });
  }
}

export const notificationRepository = new NotificationRepository();
