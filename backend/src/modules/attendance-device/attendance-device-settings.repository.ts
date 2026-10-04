import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

/** Per-madrasa device attendance rules + holidays. Every query is scoped by madrasaId. */
export class AttendanceDeviceSettingsRepository {
  findSettings(madrasaId: number) {
    return prisma.attendanceDeviceSettings.findUnique({ where: { madrasaId } });
  }

  upsertSettings(madrasaId: number, data: Omit<Prisma.AttendanceDeviceSettingsUncheckedCreateInput, "madrasaId">) {
    return prisma.attendanceDeviceSettings.upsert({
      where: { madrasaId },
      create: { ...data, madrasaId },
      update: data,
    });
  }

  /** Every madrasa that turned a job's rule on (jobs iterate these). */
  listSettingsWhere(where: Prisma.AttendanceDeviceSettingsWhereInput) {
    return prisma.attendanceDeviceSettings.findMany({ where });
  }

  setLastAutoAbsentDate(madrasaId: number, date: Date) {
    return prisma.attendanceDeviceSettings.updateMany({ where: { madrasaId }, data: { lastAutoAbsentDate: date } });
  }

  /* ================= holidays ================= */

  listHolidays(madrasaId: number, start: Date, end: Date) {
    return prisma.attendanceHoliday.findMany({
      where: { madrasaId, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });
  }

  findHoliday(madrasaId: number, date: Date) {
    return prisma.attendanceHoliday.findFirst({ where: { madrasaId, date } });
  }

  createHoliday(madrasaId: number, date: Date, title: string) {
    return prisma.attendanceHoliday.create({ data: { madrasaId, date, title } });
  }

  deleteHoliday(madrasaId: number, id: number) {
    return prisma.attendanceHoliday.deleteMany({ where: { id, madrasaId } });
  }
}

export const attendanceDeviceSettingsRepository = new AttendanceDeviceSettingsRepository();
