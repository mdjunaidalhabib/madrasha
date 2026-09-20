import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { MAX_REPROCESS_LOGS, MAX_TODAY_LOGS } from "./attendance-device.constants";

export type Db = Prisma.TransactionClient;

/** Student columns needed to decide eligibility + send the attendance SMS. */
export const RESOLVE_STUDENT_SELECT = {
  id: true,
  nameBn: true,
  classId: true,
  guardianPhone: true,
  roll: true,
  classRef: { select: { nameBn: true, name: true } },
  isActive: true,
  deletedAt: true,
  admissionStatus: true,
} as const;
export type ResolvedStudentRow = Prisma.StudentGetPayload<{ select: typeof RESOLVE_STUDENT_SELECT }>;

export class AttendanceDeviceRepository {
  /* ================= devices ================= */

  findByKeyHash(madrasaId: number, apiKeyHash: string) {
    return prisma.attendanceDevice.findFirst({ where: { madrasaId, apiKeyHash } });
  }

  listDevices(madrasaId: number) {
    return prisma.attendanceDevice.findMany({ where: { madrasaId }, orderBy: { id: "desc" } });
  }

  findDevice(madrasaId: number, id: number) {
    return prisma.attendanceDevice.findFirst({ where: { id, madrasaId } });
  }

  createDevice(data: Prisma.AttendanceDeviceUncheckedCreateInput) {
    return prisma.attendanceDevice.create({ data });
  }

  deleteDevice(madrasaId: number, id: number) {
    return prisma.attendanceDevice.deleteMany({ where: { id, madrasaId } });
  }

  /** Always scoped by (id, madrasaId) so a device can never be written across tenants. */
  updateDevice(madrasaId: number, id: number, data: Prisma.AttendanceDeviceUncheckedUpdateManyInput) {
    return prisma.attendanceDevice.updateMany({ where: { id, madrasaId }, data });
  }

  /* ================= ingest ================= */

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn, { maxWait: 10_000, timeout: 20_000 });
  }

  findMapsByDeviceUserIds(madrasaId: number, deviceUserIds: string[]) {
    return prisma.attendanceDeviceUserMap.findMany({
      where: { madrasaId, deviceUserId: { in: deviceUserIds } },
      select: { deviceUserId: true, student: { select: RESOLVE_STUDENT_SELECT } },
    });
  }

  findStudentsByFingerprintIds(madrasaId: number, fingerprintIds: string[]) {
    return prisma.student.findMany({
      where: { madrasaId, fingerprintId: { in: fingerprintIds } },
      select: { ...RESOLVE_STUDENT_SELECT, fingerprintId: true },
    });
  }

  /** ON CONFLICT DO NOTHING on every unique key: returns 0 for a duplicate
   * without aborting the surrounding transaction (a caught P2002 would). */
  insertLog(db: Db, data: Prisma.AttendanceDeviceLogCreateManyInput) {
    return db.attendanceDeviceLog.createMany({ data: [data], skipDuplicates: true });
  }

  attachAttendanceToLog(db: Db, madrasaId: number, deviceId: number, eventId: string, attendanceId: number) {
    return db.attendanceDeviceLog.updateMany({
      where: { madrasaId, deviceId, eventId },
      data: { attendanceId },
    });
  }

  findAttendance(db: Db, madrasaId: number, studentId: number, date: Date) {
    return db.attendance.findUnique({
      where: {
        madrasaId_attendeeType_attendeeId_date: { madrasaId, attendeeType: "STUDENT", attendeeId: studentId, date },
      },
    });
  }

  createAttendance(db: Db, data: Prisma.AttendanceUncheckedCreateInput) {
    return db.attendance.create({ data });
  }

  updateAttendance(db: Db, id: number, data: Prisma.AttendanceUncheckedUpdateInput) {
    return db.attendance.update({ where: { id }, data });
  }

  /* ================= SMS enqueue ================= */

  /** Atomic dedupe: returns count 0 when the dedupe key already exists. */
  enqueueSms(data: Prisma.SmsQueueCreateManyInput) {
    return prisma.smsQueue.createMany({ data: [data], skipDuplicates: true });
  }

  /* ================= reprocess ================= */

  findUnprocessedLogs(madrasaId: number, deviceUserId: string) {
    return prisma.attendanceDeviceLog.findMany({
      where: {
        madrasaId,
        deviceUserId,
        studentId: null,
        syncStatus: "SYNCED",
        OR: [{ failReason: null }, { failReason: "student_inactive" }],
      },
      orderBy: { punchedAt: "asc" },
      take: MAX_REPROCESS_LOGS,
    });
  }

  linkLogToStudent(db: Db, logId: number, studentId: number, attendanceId: number) {
    return db.attendanceDeviceLog.update({
      where: { id: logId },
      data: { studentId, attendanceId, failReason: null },
    });
  }

  /* ================= mappings ================= */

  findStudentForMapping(madrasaId: number, studentId: number) {
    return prisma.student.findFirst({
      where: { id: studentId, madrasaId, deletedAt: null },
      select: RESOLVE_STUDENT_SELECT,
    });
  }

  findMapByDeviceUserId(madrasaId: number, deviceUserId: string) {
    return prisma.attendanceDeviceUserMap.findUnique({
      where: { madrasaId_deviceUserId: { madrasaId, deviceUserId } },
      select: { studentId: true, student: { select: { nameBn: true } } },
    });
  }

  replaceMap(madrasaId: number, studentId: number, deviceUserId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.attendanceDeviceUserMap.deleteMany({ where: { madrasaId, studentId } });
      return tx.attendanceDeviceUserMap.create({ data: { madrasaId, studentId, deviceUserId } });
    });
  }

  deleteMapByStudent(madrasaId: number, studentId: number) {
    return prisma.attendanceDeviceUserMap.deleteMany({ where: { madrasaId, studentId } });
  }

  async listStudentsWithMap(
    madrasaId: number,
    q: { search?: string; classId?: number; mapped?: boolean; page: number; limit: number },
  ) {
    const where: Prisma.StudentWhereInput = {
      madrasaId,
      isActive: 1,
      deletedAt: null,
      admissionStatus: "APPROVED",
    };
    if (q.classId) where.classId = q.classId;
    if (q.mapped === true) where.attendanceDeviceMaps = { some: {} };
    if (q.mapped === false) where.attendanceDeviceMaps = { none: {} };
    if (q.search) {
      const or: Prisma.StudentWhereInput[] = [
        { nameBn: { contains: q.search, mode: "insensitive" } },
        { nameEn: { contains: q.search, mode: "insensitive" } },
        { attendanceDeviceMaps: { some: { deviceUserId: q.search } } },
      ];
      if (/^\d{1,9}$/.test(q.search)) {
        or.push({ roll: Number(q.search) }, { registrationNo: Number(q.search) });
      }
      where.OR = or;
    }

    const [rows, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: {
          id: true,
          nameBn: true,
          roll: true,
          classId: true,
          classRef: { select: { nameBn: true, name: true } },
          attendanceDeviceMaps: { select: { deviceUserId: true }, take: 1 },
        },
        orderBy: [{ classId: "asc" }, { roll: "asc" }, { id: "asc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.student.count({ where }),
    ]);
    return { rows, total };
  }

  /* ================= unmapped / today / sms-status ================= */

  groupUnmapped(madrasaId: number) {
    return prisma.attendanceDeviceLog.groupBy({
      by: ["deviceUserId", "deviceId"],
      where: { madrasaId, studentId: null, syncStatus: "SYNCED", failReason: null },
      _count: { _all: true },
      _max: { punchedAt: true },
      _min: { punchedAt: true },
    });
  }

  findDevicesByIds(madrasaId: number, ids: number[]) {
    return prisma.attendanceDevice.findMany({
      where: { madrasaId, id: { in: ids } },
      select: { id: true, deviceCode: true, name: true },
    });
  }

  findLogsForRange(madrasaId: number, start: Date, end: Date, deviceId?: number) {
    return prisma.attendanceDeviceLog.findMany({
      where: {
        madrasaId,
        punchedAt: { gte: start, lt: end },
        ...(deviceId ? { deviceId } : {}),
      },
      select: {
        id: true,
        deviceId: true,
        deviceUserId: true,
        punchedAt: true,
        studentId: true,
        syncStatus: true,
        receivedAt: true,
        failReason: true,
        device: { select: { deviceCode: true, name: true } },
      },
      orderBy: { punchedAt: "asc" },
      take: MAX_TODAY_LOGS,
    });
  }

  findStudentsByIds(madrasaId: number, ids: number[]) {
    return prisma.student.findMany({
      where: { madrasaId, id: { in: ids } },
      select: {
        id: true,
        nameBn: true,
        roll: true,
        classId: true,
        classRef: { select: { nameBn: true, name: true } },
      },
    });
  }

  findSmsForDate(madrasaId: number, forDate: Date) {
    return prisma.smsQueue.findMany({
      where: { madrasaId, forDate, source: "attendance" },
      orderBy: { id: "asc" },
      take: 5000,
    });
  }
}

export const attendanceDeviceRepository = new AttendanceDeviceRepository();
