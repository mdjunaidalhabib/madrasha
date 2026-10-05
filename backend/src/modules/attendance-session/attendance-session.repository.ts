import { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { tenantClassNameSelect } from "../../shared/utils/tenant-name.util";
import { eligibleStudentWhere } from "../attendance-device/attendance-device-people.repository";
import { RESIDENTIAL } from "./attendance-session.rules";

export const sheetStudentSelect = (madrasaId: number) =>
  ({
    id: true,
    nameBn: true,
    nameEn: true,
    roll: true,
    classId: true,
    residencyType: true,
    classRef: { select: tenantClassNameSelect(madrasaId) },
  }) satisfies Prisma.StudentSelect;

export type SheetStudentRow = Prisma.StudentGetPayload<{ select: ReturnType<typeof sheetStudentSelect> }>;

export class AttendanceSessionRepository {
  list(madrasaId: number, includeInactive: boolean) {
    return prisma.attendanceSession.findMany({
      where: { madrasaId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findById(madrasaId: number, id: number) {
    return prisma.attendanceSession.findFirst({ where: { id, madrasaId } });
  }

  findByIds(madrasaId: number, ids: number[]) {
    return prisma.attendanceSession.findMany({
      where: { madrasaId, id: { in: ids } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  create(data: Prisma.AttendanceSessionUncheckedCreateInput) {
    return prisma.attendanceSession.create({ data });
  }

  update(id: number, data: Prisma.AttendanceSessionUncheckedUpdateInput) {
    return prisma.attendanceSession.update({ where: { id }, data });
  }

  delete(id: number) {
    return prisma.attendanceSession.delete({ where: { id } });
  }

  async recordCounts(madrasaId: number, sessionIds: number[]): Promise<Map<number, number>> {
    if (!sessionIds.length) return new Map();
    const rows = await prisma.sessionAttendance.groupBy({
      by: ["sessionId"],
      where: { madrasaId, sessionId: { in: sessionIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.sessionId, r._count._all]));
  }

  /** Active (eligible) students, optionally of one class / residential only. */
  findStudents(madrasaId: number, opts: { classId?: number | null; residentialOnly?: boolean; ids?: number[] }) {
    return prisma.student.findMany({
      where: {
        madrasaId,
        ...eligibleStudentWhere,
        ...(opts.classId ? { classId: opts.classId } : {}),
        ...(opts.residentialOnly ? { residencyType: RESIDENTIAL } : {}),
        ...(opts.ids ? { id: { in: opts.ids } } : {}),
      },
      select: sheetStudentSelect(madrasaId),
      orderBy: [{ classId: "asc" }, { roll: "asc" }, { id: "asc" }],
    });
  }

  findMarks(madrasaId: number, sessionId: number, date: Date, studentIds: number[]) {
    if (!studentIds.length) return Promise.resolve([]);
    return prisma.sessionAttendance.findMany({
      where: { madrasaId, sessionId, date, studentId: { in: studentIds } },
      select: { id: true, studentId: true, status: true, remarks: true },
    });
  }

  saveMarks(
    creates: Prisma.SessionAttendanceCreateManyInput[],
    updates: Array<{ id: number; status: AttendanceStatus; remarks: string | null; markedById: number | null; classId: number | null }>,
  ) {
    return prisma.$transaction(async (tx) => {
      if (creates.length) await tx.sessionAttendance.createMany({ data: creates, skipDuplicates: true });
      for (const u of updates) {
        await tx.sessionAttendance.update({
          where: { id: u.id },
          data: { status: u.status, remarks: u.remarks, markedById: u.markedById, classId: u.classId },
        });
      }
    });
  }

  reportCounts(madrasaId: number, from: Date, to: Date, sessionIds: number[], studentIds: number[]) {
    if (!sessionIds.length || !studentIds.length) return Promise.resolve([]);
    return prisma.sessionAttendance.groupBy({
      by: ["studentId", "sessionId", "status"],
      where: {
        madrasaId,
        sessionId: { in: sessionIds },
        studentId: { in: studentIds },
        date: { gte: from, lte: to },
      },
      _count: { _all: true },
    });
  }
}

export const attendanceSessionRepository = new AttendanceSessionRepository();
