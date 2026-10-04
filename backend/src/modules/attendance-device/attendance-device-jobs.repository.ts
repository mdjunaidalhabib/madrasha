import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { AUTO_ABSENT_SOURCE } from "./attendance-device.constants";

/** Queries of the background jobs (auto-absent, device offline alert). Scoped by madrasaId. */
export class AttendanceDeviceJobsRepository {
  findAttendanceKeysForDate(madrasaId: number, date: Date) {
    return prisma.attendance.findMany({
      where: { madrasaId, date },
      select: { attendeeType: true, attendeeId: true },
    });
  }

  /** ON CONFLICT DO NOTHING: a row written meanwhile (a punch, a manual mark) always wins. */
  createAttendances(data: Prisma.AttendanceCreateManyInput[]) {
    return prisma.attendance.createMany({ data, skipDuplicates: true });
  }

  /** Students the auto-absent job marked ABSENT on `date` (and that are still ABSENT). */
  findAutoAbsentStudents(madrasaId: number, date: Date) {
    return prisma.attendance.findMany({
      where: { madrasaId, date, attendeeType: "STUDENT", status: "ABSENT", source: AUTO_ABSENT_SOURCE },
      select: { id: true, attendeeId: true },
    });
  }

  findAlertCandidates(madrasaId: number) {
    return prisma.attendanceDevice.findMany({
      where: { madrasaId, isActive: true, offlineAlertedAt: null, lastSeenAt: { not: null } },
    });
  }

  findMadrasaPhone(madrasaId: number) {
    return prisma.madrasa.findUnique({ where: { id: madrasaId }, select: { phone: true } });
  }

  markOfflineAlerted(madrasaId: number, deviceId: number, at: Date) {
    return prisma.attendanceDevice.updateMany({
      where: { id: deviceId, madrasaId, offlineAlertedAt: null },
      data: { offlineAlertedAt: at },
    });
  }

  enqueueSms(data: Prisma.SmsQueueCreateManyInput) {
    return prisma.smsQueue.createMany({ data: [data], skipDuplicates: true });
  }
}

export const attendanceDeviceJobsRepository = new AttendanceDeviceJobsRepository();
