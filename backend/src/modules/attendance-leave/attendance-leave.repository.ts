import type { AttendeeType, LeaveRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import {
  eligibleStudentWhere,
  Person,
  staffPersonSelect,
  staffToPerson,
  studentPersonSelect,
  studentToPerson,
} from "../attendance-device/attendance-device-people.repository";
import { dateOnly } from "../attendance/core/attendance-calendar";

export type Db = Prisma.TransactionClient;

/** Data access of the leave workflow + consecutive-absence alerts. Every query is scoped by madrasaId. */
export class AttendanceLeaveRepository {
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn, { maxWait: 10_000, timeout: 30_000 });
  }

  /* ================= leave requests ================= */

  async list(madrasaId: number, where: Prisma.LeaveRequestWhereInput, skip: number, take: number) {
    const full = { ...where, madrasaId };
    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({ where: full, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }),
      prisma.leaveRequest.count({ where: full }),
    ]);
    return { items, total };
  }

  findAll(madrasaId: number, where: Prisma.LeaveRequestWhereInput, take: number) {
    return prisma.leaveRequest.findMany({
      where: { ...where, madrasaId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
  }

  findById(madrasaId: number, id: number, db: Db | typeof prisma = prisma) {
    return db.leaveRequest.findFirst({ where: { id, madrasaId } });
  }

  /** An open (PENDING / APPROVED) request of the attendee overlapping [from, to]. */
  findOverlap(madrasaId: number, attendeeType: AttendeeType, attendeeId: number, from: string, to: string, db: Db | typeof prisma = prisma) {
    return db.leaveRequest.findFirst({
      where: {
        madrasaId,
        attendeeType,
        attendeeId,
        status: { in: ["PENDING", "APPROVED"] },
        fromDate: { lte: dateOnly(to) },
        toDate: { gte: dateOnly(from) },
      },
      select: { id: true, status: true },
    });
  }

  create(db: Db, data: Prisma.LeaveRequestUncheckedCreateInput) {
    return db.leaveRequest.create({ data });
  }

  /** Status transition guarded by the expected current status (double-click / race safe). */
  transition(db: Db, madrasaId: number, id: number, from: LeaveRequestStatus[], data: Prisma.LeaveRequestUncheckedUpdateManyInput) {
    return db.leaveRequest.updateMany({ where: { id, madrasaId, status: { in: from } }, data });
  }

  /* ================= attendance rows ================= */

  findAttendanceInRange(db: Db, madrasaId: number, attendeeType: AttendeeType, attendeeId: number, from: string, to: string) {
    return db.attendance.findMany({
      where: { madrasaId, attendeeType, attendeeId, date: { gte: dateOnly(from), lte: dateOnly(to) } },
      select: { id: true, date: true, status: true, source: true },
    });
  }

  createAttendances(db: Db, data: Prisma.AttendanceCreateManyInput[]) {
    return db.attendance.createManyAndReturn({ data, select: { id: true, date: true }, skipDuplicates: true });
  }

  updateAttendanceStatus(db: Db, ids: number[], data: Prisma.AttendanceUncheckedUpdateManyInput) {
    return db.attendance.updateMany({ where: { id: { in: ids } }, data });
  }

  deleteAttendances(db: Db, madrasaId: number, ids: number[]) {
    return db.attendance.deleteMany({ where: { madrasaId, id: { in: ids } } });
  }

  /* ================= people ================= */

  async findPeople(madrasaId: number, type: AttendeeType, ids: number[]): Promise<Person[]> {
    if (!ids.length) return [];
    if (type === "STUDENT") {
      const rows = await prisma.student.findMany({
        where: { madrasaId, id: { in: ids } },
        select: studentPersonSelect(madrasaId),
      });
      return rows.map(studentToPerson);
    }
    const delegate = (type === "TEACHER" ? prisma.teacher : prisma.staff) as typeof prisma.teacher;
    const rows = await delegate.findMany({ where: { madrasaId, id: { in: ids } }, select: staffPersonSelect });
    return rows.map((r) => staffToPerson(type, r));
  }

  async findUserNames(ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((u) => [u.id, u.name ?? ""]));
  }

  async findGuardianNames(madrasaId: number, ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const rows = await prisma.guardian.findMany({
      where: { madrasaId, id: { in: ids } },
      select: { id: true, name: true, phone: true },
    });
    return new Map(rows.map((g) => [g.id, g.name || g.phone]));
  }

  /* ================= consecutive absence ================= */

  /** Students (eligible) with an ABSENT row on EVERY one of `dates`. */
  async findStudentsAbsentOnAll(madrasaId: number, dates: string[], classId?: number): Promise<number[]> {
    if (!dates.length) return [];
    const rows = await prisma.attendance.groupBy({
      by: ["attendeeId"],
      where: {
        madrasaId,
        attendeeType: "STUDENT",
        status: "ABSENT",
        date: { in: dates.map(dateOnly) },
        ...(classId ? { classId } : {}),
      },
      _count: { _all: true },
    });
    return rows.filter((r) => r._count._all >= dates.length).map((r) => r.attendeeId);
  }

  findEligibleStudents(madrasaId: number, ids: number[], classId?: number) {
    if (!ids.length) return Promise.resolve([]);
    return prisma.student
      .findMany({
        where: { madrasaId, id: { in: ids }, ...eligibleStudentWhere, ...(classId ? { classId } : {}) },
        select: studentPersonSelect(madrasaId),
      })
      .then((rows) => rows.map(studentToPerson));
  }

  findStudentRows(madrasaId: number, studentIds: number[], from: string, to: string) {
    return prisma.attendance.findMany({
      where: {
        madrasaId,
        attendeeType: "STUDENT",
        attendeeId: { in: studentIds },
        date: { gte: dateOnly(from), lte: dateOnly(to) },
      },
      select: { id: true, attendeeId: true, date: true, status: true },
    });
  }

  /** Newest consecutive-alert date per student (SmsQueue rows of the alert source). */
  async lastAlertDates(madrasaId: number, source: string, studentIds: number[], since: string): Promise<Map<number, string>> {
    if (!studentIds.length) return new Map();
    const rows = await prisma.smsQueue.groupBy({
      by: ["studentId"],
      where: { madrasaId, source, studentId: { in: studentIds }, forDate: { gte: dateOnly(since) } },
      _max: { forDate: true },
    });
    const out = new Map<number, string>();
    for (const r of rows) {
      if (r.studentId && r._max.forDate) out.set(r.studentId, r._max.forDate.toISOString().slice(0, 10));
    }
    return out;
  }
}

export const attendanceLeaveRepository = new AttendanceLeaveRepository();
