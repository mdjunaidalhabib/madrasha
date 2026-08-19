import { prisma } from "../../shared/database/prisma";

export class KioskRepository {
  findActiveDeviceByKeyHash(madrasaId: number, apiKeyHash: string) {
    return prisma.kioskDevice.findFirst({
      where: { madrasaId, apiKeyHash, isActive: true },
    });
  }

  /** Fire-and-forget-safe: callers intentionally don't await this. */
  touchLastSeen(id: number) {
    return prisma.kioskDevice.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }

  findStudentByCardUid(madrasaId: number, cardUid: string) {
    return prisma.student.findFirst({
      where: { madrasaId, cardUid, isActive: 1, deletedAt: null },
      select: { id: true, nameBn: true, roll: true, classId: true, image: true },
    });
  }

  findStudentByFingerprintId(madrasaId: number, fingerprintId: string) {
    return prisma.student.findFirst({
      where: { madrasaId, fingerprintId, isActive: 1, deletedAt: null },
      select: { id: true, nameBn: true, roll: true, classId: true, image: true },
    });
  }

  findTodayAttendance(madrasaId: number, studentId: number, date: Date) {
    return prisma.attendance.findUnique({
      where: {
        madrasaId_attendeeType_attendeeId_date: {
          madrasaId,
          attendeeType: "STUDENT" as any,
          attendeeId: studentId,
          date,
        },
      },
    });
  }

  /** Same upsert shape as AttendanceRepository.upsertMany, but for a single
   * kiosk scan (source is "card"/"fingerprint" instead of "manual", and
   * there is no logged-in admin so markedById is always null). */
  markPresent(madrasaId: number, studentId: number, classId: number | null, date: Date, source: string) {
    return prisma.attendance.upsert({
      where: {
        madrasaId_attendeeType_attendeeId_date: {
          madrasaId,
          attendeeType: "STUDENT" as any,
          attendeeId: studentId,
          date,
        },
      },
      update: {
        status: "PRESENT" as any,
        source,
        classId,
        markedById: null,
      },
      create: {
        madrasaId,
        attendeeType: "STUDENT" as any,
        attendeeId: studentId,
        classId,
        date,
        status: "PRESENT" as any,
        remarks: null,
        markedById: null,
        source,
      },
    });
  }

  createDevice(madrasaId: number, name: string, apiKeyHash: string) {
    return prisma.kioskDevice.create({
      data: { madrasaId, name, apiKeyHash },
    });
  }

  listDevices(madrasaId: number) {
    return prisma.kioskDevice.findMany({
      where: { madrasaId },
      orderBy: { id: "desc" },
    });
  }

  setDeviceActive(madrasaId: number, id: number, isActive: boolean) {
    return prisma.kioskDevice.updateMany({
      where: { id, madrasaId },
      data: { isActive },
    });
  }

  deleteDevice(madrasaId: number, id: number) {
    return prisma.kioskDevice.deleteMany({
      where: { id, madrasaId },
    });
  }

  /** Assigns/replaces the RFID/NFC card UID used for kiosk attendance
   * scanning. `cardUid` is globally unique (Student.cardUid @unique), so
   * reassigning a card already on another student throws Prisma P2002. */
  setStudentCardUid(madrasaId: number, studentId: number, cardUid: string) {
    return prisma.student.updateMany({
      where: { id: studentId, madrasaId },
      data: { cardUid },
    });
  }
}

export const kioskRepository = new KioskRepository();
