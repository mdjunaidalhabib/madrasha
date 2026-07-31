import { BadRequestError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { ApiError } from "../../shared/errors";
import { attendanceRepository, AttendanceRepository } from "./attendance.repository";
import {
  AttendanceQueryDto,
  AttendanceSummaryQueryDto,
  BulkMarkAttendanceRequestDto,
} from "./attendance.dto";
import { ATTENDEE_TYPES, ATTENDANCE_STATUSES } from "./attendance.constants";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

const parseDateOnly = (value: string | undefined, label: string): Date => {
  if (!value) throw new BadRequestError(`${label} is required`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestError(`${label} is invalid`);
  return date;
};

export class AttendanceService {
  constructor(private readonly repository: AttendanceRepository = attendanceRepository) {}

  async bulkMark(
    madrasaId: number,
    markedById: number | undefined,
    dto: BulkMarkAttendanceRequestDto,
  ) {
    const attendeeType = String(dto.attendee_type || "").toUpperCase();
    if (!ATTENDEE_TYPES.includes(attendeeType as any)) {
      throw new BadRequestError("attendee_type must be STUDENT, TEACHER or STAFF");
    }

    const date = parseDateOnly(dto.date, "date");

    if (!Array.isArray(dto.entries) || dto.entries.length === 0) {
      throw new BadRequestError("entries must be a non-empty array");
    }

    const classId = dto.class_id ? Number(dto.class_id) : null;

    const rows = dto.entries.map((entry) => {
      const status = String(entry.status || "").toUpperCase();
      if (!ATTENDANCE_STATUSES.includes(status as any)) {
        throw new BadRequestError(
          `Invalid status "${entry.status}" for attendee ${entry.attendee_id}`,
        );
      }
      if (entry.attendee_id === undefined || entry.attendee_id === null) {
        throw new BadRequestError("attendee_id is required for every entry");
      }

      return {
        attendeeType,
        attendeeId: Number(entry.attendee_id),
        classId,
        date,
        status,
        remarks: entry.remarks?.trim() || null,
        markedById: markedById ?? null,
      };
    });

    try {
      await this.repository.upsertMany(madrasaId, rows);
      return rows.length;
    } catch (err) {
      return friendlyFailure("bulkMarkAttendance error:", err, "Failed to save attendance");
    }
  }

  async list(madrasaId: number, query: AttendanceQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.class_id) where.classId = Number(query.class_id);
    if (query.attendee_type) where.attendeeType = String(query.attendee_type).toUpperCase();
    if (query.attendee_id) where.attendeeId = Number(query.attendee_id);

    if (query.date) {
      where.date = parseDateOnly(query.date, "date");
    } else if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: parseDateOnly(query.from, "from") } : {}),
        ...(query.to ? { lte: parseDateOnly(query.to, "to") } : {}),
      };
    }

    try {
      return await this.repository.findMany(madrasaId, where as any);
    } catch (err) {
      return friendlyFailure("listAttendance error:", err, "Failed to load attendance");
    }
  }

  async summary(madrasaId: number, query: AttendanceSummaryQueryDto) {
    if (!query.attendee_id) throw new BadRequestError("attendee_id is required");
    const attendeeType = String(query.attendee_type || "").toUpperCase();
    if (!ATTENDEE_TYPES.includes(attendeeType as any)) {
      throw new BadRequestError("attendee_type must be STUDENT, TEACHER or STAFF");
    }

    const month = query.month || new Date().toISOString().slice(0, 7);
    const [year, monthNum] = month.split("-").map(Number);
    if (!year || !monthNum) throw new BadRequestError("month must be in YYYY-MM format");

    const from = new Date(Date.UTC(year, monthNum - 1, 1));
    const to = new Date(Date.UTC(year, monthNum, 0));

    try {
      const grouped = await this.repository.getSummary(
        madrasaId,
        attendeeType,
        Number(query.attendee_id),
        from,
        to,
      );

      const counts: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
      let total = 0;
      for (const row of grouped as Array<{ status: string; _count: { _all: number } }>) {
        counts[row.status] = row._count._all;
        total += row._count._all;
      }

      const presentDays = counts.PRESENT + counts.LATE;
      const percentage = total > 0 ? Math.round((presentDays / total) * 1000) / 10 : 0;

      return { month, ...counts, total, percentage };
    } catch (err) {
      return friendlyFailure("attendanceSummary error:", err, "Failed to load attendance summary");
    }
  }
}

export const attendanceService = new AttendanceService();
