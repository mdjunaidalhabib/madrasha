import { AttendeeType, Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export class AttendanceRepository {
  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(fn, { timeout: 30_000 });
  }

  /** Existing rows of the given attendees on one date (inside the marking transaction). */
  findForDate(db: Db, madrasaId: number, attendeeType: AttendeeType, attendeeIds: number[], date: Date) {
    return db.attendance.findMany({
      where: { madrasaId, attendeeType, attendeeId: { in: attendeeIds }, date },
    });
  }

  create(db: Db, data: Prisma.AttendanceUncheckedCreateInput) {
    return db.attendance.create({ data });
  }

  update(db: Db, id: number, data: Prisma.AttendanceUncheckedUpdateInput) {
    return db.attendance.update({ where: { id }, data });
  }

  findById(madrasaId: number, id: number) {
    return prisma.attendance.findFirst({ where: { id, madrasaId } });
  }

  findMany(madrasaId: number, where: Prisma.AttendanceWhereInput) {
    return prisma.attendance.findMany({
      where: { madrasaId, ...where },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
  }

  /** Active students of a class (same filter as the device module's isEligibleStudent). */
  async activeStudentIdsOfClass(madrasaId: number, classId: number): Promise<number[]> {
    const rows = await prisma.student.findMany({
      where: { madrasaId, classId, isActive: 1, deletedAt: null, admissionStatus: "APPROVED" },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => r.id);
  }

  /** Everybody of a type that has at least one attendance row in the madrasa. */
  async attendeeIdsWithRecords(madrasaId: number, attendeeType: AttendeeType): Promise<number[]> {
    const rows = await prisma.attendance.groupBy({
      by: ["attendeeId"],
      where: { madrasaId, attendeeType },
    });
    return rows.map((r) => r.attendeeId).sort((a, b) => a - b);
  }
}

export const attendanceRepository = new AttendanceRepository();
