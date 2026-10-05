import type { AttendeeType, Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { tenantClassName, tenantClassNameSelect } from "../../shared/utils/tenant-name.util";
import { eligibleStaffWhere, eligibleStudentWhere } from "../attendance-device/attendance-device-people.repository";

export interface PersonRow {
  id: number;
  name: string;
  classId: number | null;
  className: string | null;
  roll: number | null;
  guardianPhone: string | null;
  designation: string | null;
  salary: number | null;
}

const studentSelect = (madrasaId: number) =>
  ({
    id: true,
    nameBn: true,
    nameEn: true,
    roll: true,
    classId: true,
    guardianPhone: true,
    classRef: { select: tenantClassNameSelect(madrasaId) },
  }) satisfies Prisma.StudentSelect;

const staffSelect = { id: true, nameBn: true, nameEn: true, designation: true, salary: true } as const;

export class AttendanceAnalyticsRepository {
  /** Active students (id + class only) - cheap population for counts. */
  studentIds(madrasaId: number, classId?: number | null) {
    return prisma.student.findMany({
      where: { madrasaId, ...eligibleStudentWhere, ...(classId ? { classId } : {}) },
      select: { id: true, classId: true },
    });
  }

  /** Active teachers / staff ids. */
  async staffIds(madrasaId: number, type: "TEACHER" | "STAFF"): Promise<number[]> {
    const where = { madrasaId, ...eligibleStaffWhere };
    const rows =
      type === "TEACHER"
        ? await prisma.teacher.findMany({ where, select: { id: true } })
        : await prisma.staff.findMany({ where, select: { id: true } });
    return rows.map((r) => r.id);
  }

  /** Active people of a type with display fields (and salary for teachers/staff). */
  async people(madrasaId: number, type: AttendeeType, classId?: number | null): Promise<PersonRow[]> {
    if (type === "STUDENT") {
      const rows = await prisma.student.findMany({
        where: { madrasaId, ...eligibleStudentWhere, ...(classId ? { classId } : {}) },
        select: studentSelect(madrasaId),
        orderBy: [{ classId: "asc" }, { roll: "asc" }, { id: "asc" }],
      });
      return rows.map((s) => {
        return {
          id: s.id,
          name: s.nameBn || s.nameEn || `#${s.id}`,
          classId: s.classId,
          className: tenantClassName(s.classRef),
          roll: s.roll,
          guardianPhone: s.guardianPhone,
          designation: null,
          salary: null,
        };
      });
    }
    const where = { madrasaId, ...eligibleStaffWhere };
    const rows =
      type === "TEACHER"
        ? await prisma.teacher.findMany({ where, select: staffSelect, orderBy: { id: "asc" } })
        : await prisma.staff.findMany({ where, select: staffSelect, orderBy: { id: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      name: r.nameBn || r.nameEn || `#${r.id}`,
      classId: null,
      className: null,
      roll: null,
      guardianPhone: null,
      designation: r.designation,
      salary: r.salary === null ? null : Number(r.salary),
    }));
  }

  /** Class names + this madrasa's sort order for the given class ids. */
  classes(madrasaId: number, classIds: number[]) {
    if (!classIds.length) return Promise.resolve([]);
    return prisma.class.findMany({
      where: { id: { in: classIds } },
      select: {
        id: true,
        nameBn: true,
        name: true,
        sortOrder: true,
        madrasaClasses: { where: { madrasaId }, select: { nameBn: true, sortOrder: true }, take: 1 },
      },
    });
  }

  /** Every attendance row of one date (status only). */
  dayRows(madrasaId: number, date: Date) {
    return prisma.attendance.findMany({
      where: { madrasaId, date },
      select: { attendeeType: true, attendeeId: true, status: true },
    });
  }

  /** (date, status) counts of a type over a range, limited to the given attendees. */
  trendCounts(madrasaId: number, type: AttendeeType, ids: number[], from: Date, to: Date) {
    if (!ids.length) return Promise.resolve([]);
    return prisma.attendance.groupBy({
      by: ["date", "status"],
      where: { madrasaId, attendeeType: type, attendeeId: { in: ids }, date: { gte: from, lte: to } },
      _count: { _all: true },
    });
  }

  /** Rows carrying device check-in/out times, for worked minutes / average check-in. */
  checkTimes(madrasaId: number, type: AttendeeType, ids: number[], from: Date, to: Date) {
    if (!ids.length) return Promise.resolve([]);
    return prisma.attendance.findMany({
      where: {
        madrasaId,
        attendeeType: type,
        attendeeId: { in: ids },
        date: { gte: from, lte: to },
        checkInAt: { not: null },
      },
      select: { attendeeId: true, checkInAt: true, checkOutAt: true },
    });
  }

  payrollRecords(madrasaId: number, month: string, teacherIds: number[]) {
    if (!teacherIds.length) return Promise.resolve([]);
    return prisma.payrollRecord.findMany({
      where: { madrasaId, month, teacherId: { in: teacherIds } },
      select: { id: true, teacherId: true, status: true, basicSalary: true, allowances: true, deductions: true, netAmount: true },
    });
  }

  applyDeductions(updates: Array<{ id: number; deductions: number; netAmount: number }>) {
    return prisma.$transaction(async (tx) => {
      let updated = 0;
      for (const u of updates) {
        // Re-checks PENDING inside the transaction so a record paid meanwhile is never rewritten.
        const res = await tx.payrollRecord.updateMany({
          where: { id: u.id, status: "PENDING" },
          data: { deductions: u.deductions, netAmount: u.netAmount },
        });
        updated += res.count;
      }
      return updated;
    });
  }
}

export const attendanceAnalyticsRepository = new AttendanceAnalyticsRepository();
