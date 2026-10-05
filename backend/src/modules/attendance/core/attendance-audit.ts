import type { AttendanceStatus, AttendeeType, Prisma } from "@prisma/client";
import { prisma } from "../../../shared/database/prisma";

/**
 * Append-only attendance audit trail (attendance_changes). Every code path
 * that changes an EXISTING attendance row's status (or deletes one) writes a
 * row here inside the same transaction. First-time creation by the device or
 * auto-absent job is not audited (the row itself + device log already say
 * where it came from); a first-time manual mark is.
 */

export const AUDIT_VIA = ["manual", "correction", "leave", "leave_cancel"] as const;
export type AuditVia = (typeof AUDIT_VIA)[number];

export interface AttendanceChangeInput {
  madrasaId: number;
  attendanceId: number | null;
  attendeeType: AttendeeType;
  attendeeId: number;
  /** DATE value (UTC midnight). */
  date: Date;
  oldStatus: AttendanceStatus | null;
  newStatus: AttendanceStatus | null;
  oldSource: string | null;
  newSource: string | null;
  reason: string | null;
  via: AuditVia;
  changedById: number | null;
}

type Db = Prisma.TransactionClient | typeof prisma;

/** Writes audit rows, skipping entries whose status AND source did not change. */
export const recordAttendanceChanges = async (db: Db, rows: AttendanceChangeInput[]): Promise<number> => {
  const changed = rows.filter((r) => r.oldStatus !== r.newStatus || r.oldSource !== r.newSource);
  if (!changed.length) return 0;
  const res = await db.attendanceChange.createMany({
    data: changed.map((r) => ({ ...r, reason: r.reason ? r.reason.slice(0, 255) : null })),
  });
  return res.count;
};

/** History of one attendee (optionally one date), newest first, with the changer's name. */
export const listAttendanceChanges = async (
  madrasaId: number,
  filter: { attendeeType?: AttendeeType; attendeeId?: number; date?: Date; attendanceId?: number; limit?: number },
) => {
  const rows = await prisma.attendanceChange.findMany({
    where: {
      madrasaId,
      ...(filter.attendeeType ? { attendeeType: filter.attendeeType } : {}),
      ...(filter.attendeeId ? { attendeeId: filter.attendeeId } : {}),
      ...(filter.date ? { date: filter.date } : {}),
      ...(filter.attendanceId ? { attendanceId: filter.attendanceId } : {}),
    },
    orderBy: { id: "desc" },
    take: Math.min(Math.max(filter.limit ?? 100, 1), 500),
  });
  const userIds = [...new Set(rows.map((r) => r.changedById).filter((id): id is number => id !== null))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    attendance_id: r.attendanceId,
    attendee_type: r.attendeeType,
    attendee_id: r.attendeeId,
    date: r.date.toISOString().slice(0, 10),
    old_status: r.oldStatus,
    new_status: r.newStatus,
    old_source: r.oldSource,
    new_source: r.newSource,
    reason: r.reason,
    via: r.via,
    changed_by: r.changedById,
    changed_by_name: r.changedById ? nameById.get(r.changedById) ?? null : null,
    changed_at: r.createdAt.toISOString(),
  }));
};
