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

  findSetting(madrasaId: number, eventKey: string) {
    return prisma.notificationSetting.findUnique({
      where: { madrasaId_eventKey: { madrasaId, eventKey } },
    });
  }

  findAllSettings(madrasaId: number) {
    return prisma.notificationSetting.findMany({ where: { madrasaId } });
  }

  upsertSetting(
    madrasaId: number,
    eventKey: string,
    data: { isEnabled: number; template: string },
  ) {
    return prisma.notificationSetting.upsert({
      where: { madrasaId_eventKey: { madrasaId, eventKey } },
      update: data,
      create: { madrasaId, eventKey, ...data },
    });
  }
}

export const notificationRepository = new NotificationRepository();
