import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { MAX_REPROCESS_LOGS, MAX_TODAY_LOGS, PersonType } from "./attendance-device.constants";
import { tenantClassNameSelect } from "../../shared/utils/tenant-name.util";
import { PersonRef, personIdColumns, studentPersonSelect } from "./attendance-device-people.repository";

export type Db = Prisma.TransactionClient;

/** Student columns needed to decide eligibility + send the attendance SMS. */
export const resolveStudentSelect = (madrasaId: number) =>
  ({
    id: true,
    nameBn: true,
    classId: true,
    guardianPhone: true,
    roll: true,
    classRef: { select: tenantClassNameSelect(madrasaId) },
    isActive: true,
    deletedAt: true,
    admissionStatus: true,
  }) satisfies Prisma.StudentSelect;
export type ResolvedStudentRow = Prisma.StudentGetPayload<{ select: ReturnType<typeof resolveStudentSelect> }>;

/** failReason values of a log that is still waiting for a (usable) person. */
export const REPROCESSABLE_FAIL_REASONS = ["student_inactive", "inactive"];

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

  /** Fallback resolution (no map row): Student.fingerprintId == deviceUserId. */
  findStudentsByFingerprintIds(madrasaId: number, fingerprintIds: string[]) {
    return prisma.student.findMany({
      where: { madrasaId, fingerprintId: { in: fingerprintIds } },
      select: { ...studentPersonSelect(madrasaId), fingerprintId: true },
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

  findAttendance(db: Db, madrasaId: number, attendeeType: PersonType, attendeeId: number, date: Date) {
    return db.attendance.findUnique({
      where: {
        madrasaId_attendeeType_attendeeId_date: { madrasaId, attendeeType, attendeeId, date },
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
        teacherId: null,
        staffId: null,
        syncStatus: "SYNCED",
        OR: [{ failReason: null }, { failReason: { in: REPROCESSABLE_FAIL_REASONS } }],
      },
      orderBy: { punchedAt: "asc" },
      take: MAX_REPROCESS_LOGS,
    });
  }

  linkLogToPerson(db: Db, logId: number, ref: PersonRef, attendanceId: number | null, failReason: string | null) {
    return db.attendanceDeviceLog.update({
      where: { id: logId },
      data: { ...personIdColumns(ref), attendanceId, failReason },
    });
  }

  /* ================= mappings (legacy student endpoints) ================= */

  findStudentForMapping(madrasaId: number, studentId: number) {
    return prisma.student.findFirst({
      where: { id: studentId, madrasaId, deletedAt: null },
      select: resolveStudentSelect(madrasaId),
    });
  }

  /** Keeps the row (and its RFID card) when a student is re-mapped to another PIN. */
  replaceMap(madrasaId: number, studentId: number, deviceUserId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceDeviceUserMap.findFirst({ where: { madrasaId, studentId } });
      if (existing) {
        return tx.attendanceDeviceUserMap.update({
          where: { id: existing.id },
          data: { deviceUserId, autoAssigned: false, previousDeviceUserId: null },
        });
      }
      return tx.attendanceDeviceUserMap.create({
        data: { madrasaId, attendeeType: "STUDENT", studentId, deviceUserId, autoAssigned: false },
      });
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
          classRef: { select: tenantClassNameSelect(madrasaId) },
          attendanceDeviceMaps: { select: { deviceUserId: true, cardNumber: true }, take: 1 },
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
      where: { madrasaId, studentId: null, teacherId: null, staffId: null, syncStatus: "SYNCED", failReason: null },
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

  /**
   * Punch logs of a day. `type` narrows to one person type; for STUDENT the
   * logs that resolved to nobody (unmapped / inactive) are included too, so
   * the default Today view keeps showing them.
   */
  findLogsForRange(madrasaId: number, start: Date, end: Date, deviceId?: number, type?: PersonType) {
    const typeWhere: Prisma.AttendanceDeviceLogWhereInput =
      type === "TEACHER"
        ? { teacherId: { not: null } }
        : type === "STAFF"
          ? { staffId: { not: null } }
          : type === "STUDENT"
            ? { teacherId: null, staffId: null }
            : {};
    return prisma.attendanceDeviceLog.findMany({
      where: {
        madrasaId,
        punchedAt: { gte: start, lt: end },
        ...(deviceId ? { deviceId } : {}),
        ...typeWhere,
      },
      select: {
        id: true,
        deviceId: true,
        deviceUserId: true,
        punchedAt: true,
        studentId: true,
        teacherId: true,
        staffId: true,
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
        classRef: { select: tenantClassNameSelect(madrasaId) },
      },
    });
  }

  findStaffNamesByIds(madrasaId: number, type: "TEACHER" | "STAFF", ids: number[]) {
    const delegate = (type === "TEACHER" ? prisma.teacher : prisma.staff) as typeof prisma.teacher;
    return delegate.findMany({ where: { madrasaId, id: { in: ids } }, select: { id: true, nameBn: true } });
  }

  findAttendanceForDate(madrasaId: number, date: Date, attendeeType?: PersonType) {
    return prisma.attendance.findMany({
      where: { madrasaId, date, ...(attendeeType ? { attendeeType } : {}) },
      select: {
        id: true,
        attendeeType: true,
        attendeeId: true,
        status: true,
        source: true,
        checkInAt: true,
        checkOutAt: true,
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
