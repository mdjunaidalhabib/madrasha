import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export class AttendanceRepository {
  /** Bulk upsert: marking the same class/date twice just overwrites the
   * previous entries instead of failing on the unique constraint. */
  async upsertMany(
    madrasaId: number,
    rows: Array<{
      attendeeType: string;
      attendeeId: number;
      classId: number | null;
      date: Date;
      status: string;
      remarks: string | null;
      markedById: number | null;
    }>,
  ) {
    return prisma.$transaction(
      rows.map((row) =>
        prisma.attendance.upsert({
          where: {
            madrasaId_attendeeType_attendeeId_date: {
              madrasaId,
              attendeeType: row.attendeeType as any,
              attendeeId: row.attendeeId,
              date: row.date,
            },
          },
          update: {
            status: row.status as any,
            remarks: row.remarks,
            markedById: row.markedById,
            classId: row.classId,
            source: "manual",
          },
          create: {
            madrasaId,
            attendeeType: row.attendeeType as any,
            attendeeId: row.attendeeId,
            classId: row.classId,
            date: row.date,
            status: row.status as any,
            remarks: row.remarks,
            markedById: row.markedById,
            source: "manual",
          },
        }),
      ),
    );
  }

  findMany(madrasaId: number, where: Prisma.AttendanceWhereInput) {
    return prisma.attendance.findMany({
      where: { madrasaId, ...where },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
  }

  /** Present/absent/late/leave counts for one attendee over a date range,
   * used to build the monthly attendance summary/percentage. */
  async getSummary(
    madrasaId: number,
    attendeeType: string,
    attendeeId: number,
    from: Date,
    to: Date,
  ) {
    return prisma.attendance.groupBy({
      by: ["status"],
      where: {
        madrasaId,
        attendeeType: attendeeType as any,
        attendeeId,
        date: { gte: from, lte: to },
      },
      _count: { _all: true },
    });
  }
}

export const attendanceRepository = new AttendanceRepository();
