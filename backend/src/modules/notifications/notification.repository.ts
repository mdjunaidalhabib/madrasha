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

  /* ================= DASHBOARD SUMMARY ================= */

  groupByChannelAndStatus(madrasaId: number) {
    return prisma.notificationLog.groupBy({
      by: ["channel", "status"],
      where: { madrasaId },
      _count: { _all: true },
    });
  }

  /** Daily sent/failed counts for the last `limit` days with at least one
   * notification, oldest first - feeds the SMS/ইমেইল dashboard's sending
   * trend chart. Raw SQL since GROUP BY on a formatted date has no clean
   * Prisma equivalent (same reasoning as dashboard.repository.ts's
   * period-based queries). */
  findDailyTrend(madrasaId: number, days: number) {
    return prisma.$queryRaw<{ period: string; sent: bigint; failed: bigint }[]>`
      SELECT to_char(created_at, 'YYYY-MM-DD') AS period,
        COUNT(*) FILTER (WHERE status = 'SENT') AS sent,
        COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
      FROM notification_logs
      WHERE madrasa_id = ${madrasaId} AND created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }
}

export const notificationRepository = new NotificationRepository();
