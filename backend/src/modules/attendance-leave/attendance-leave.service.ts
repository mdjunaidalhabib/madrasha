import type { AttendeeType, LeaveRequest, LeaveRequestStatus, Prisma } from "@prisma/client";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { t } from "../../shared/i18n";
import { attendanceCalendar, AttendanceCalendar, addDays, dateOnly, todayLocal } from "../attendance/core/attendance-calendar";
import { AttendanceChangeInput, recordAttendanceChanges } from "../attendance/core/attendance-audit";
import type { Person } from "../attendance-device/attendance-device-people.repository";
import {
  GUARDIAN_BACKDATE_DAYS,
  LEAVE_ATTENDANCE_SOURCE,
  MAX_ADMIN_LEAVE_DAYS,
  MAX_GUARDIAN_LEAVE_DAYS,
  REQUESTED_VIA_ADMIN,
  REQUESTED_VIA_GUARDIAN,
} from "./attendance-leave.constants";
import type { CreateLeaveDto, GuardianCreateLeaveDto, ListLeavesQuery } from "./attendance-leave.dto";
import { attendanceLeaveRepository, AttendanceLeaveRepository, Db } from "./attendance-leave.repository";
import { checkLeaveRange, ExistingRow, planLeaveApproval, planLeaveRemoval, RangeError } from "./attendance-leave.rules";

export interface LeaveItem {
  id: number;
  attendee_type: AttendeeType;
  attendee_id: number;
  attendee_name: string | null;
  class_name?: string | null;
  roll?: number | null;
  from_date: string;
  to_date: string;
  /** Working days in the range. */
  days: number;
  leave_type: string;
  reason: string;
  status: LeaveRequestStatus;
  requested_via: string;
  requested_by_name: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface ApproveResult {
  request: LeaveItem;
  days_marked: number;
  days_skipped: number;
}

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

const rangeMessage = (err: RangeError, maxDays: number): string => {
  if (err === "from_after_to") return t({ bn: "শুরুর তারিখ শেষের তারিখের পরে হতে পারে না", en: "from_date cannot be after to_date" });
  if (err === "too_long") return t({ bn: `ছুটি সর্বোচ্চ ${maxDays} দিনের হতে পারে`, en: `Leave can be at most ${maxDays} days` });
  return t({
    bn: `${GUARDIAN_BACKDATE_DAYS} দিনের বেশি আগের তারিখ থেকে ছুটির আবেদন করা যায় না`,
    en: `Leave cannot start more than ${GUARDIAN_BACKDATE_DAYS} days in the past`,
  });
};

/**
 * Leave workflow (attendance/ATTENDANCE_V3_API.md section 2). Approval writes
 * LEAVE rows (source "leave") on every WORKING day of the range; cancel /
 * reject of an approved request removes exactly those rows again. Both run in
 * one transaction together with the status change and the audit trail.
 */
export class AttendanceLeaveService {
  constructor(
    private readonly repository: AttendanceLeaveRepository = attendanceLeaveRepository,
    private readonly calendar: AttendanceCalendar = attendanceCalendar,
  ) {}

  /* ================= read ================= */

  async list(madrasaId: number, q: ListLeavesQuery) {
    const where: Prisma.LeaveRequestWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.attendee_type ? { attendeeType: q.attendee_type } : {}),
      ...(q.attendee_id ? { attendeeId: q.attendee_id } : {}),
      // Overlap with [from, to].
      ...(q.to ? { fromDate: { lte: dateOnly(q.to) } } : {}),
      ...(q.from ? { toDate: { gte: dateOnly(q.from) } } : {}),
    };
    const { items, total } = await this.repository.list(madrasaId, where, (q.page - 1) * q.limit, q.limit);
    return { items: await this.toItems(madrasaId, items), total, page: q.page, limit: q.limit };
  }

  async get(madrasaId: number, id: number): Promise<LeaveItem> {
    const row = await this.repository.findById(madrasaId, id);
    if (!row) throw this.notFound();
    return (await this.toItems(madrasaId, [row]))[0];
  }

  /* ================= admin write ================= */

  async create(madrasaId: number, userId: number | null, dto: CreateLeaveDto): Promise<LeaveItem | (LeaveItem & Omit<ApproveResult, "request">)> {
    const rangeErr = checkLeaveRange(dto.from_date, dto.to_date, MAX_ADMIN_LEAVE_DAYS, null);
    if (rangeErr) throw new BadRequestError(rangeMessage(rangeErr, MAX_ADMIN_LEAVE_DAYS));
    const person = await this.findPerson(madrasaId, dto.attendee_type, dto.attendee_id);
    if (!person) throw new NotFoundError(t({ bn: "ব্যক্তি পাওয়া যায়নি", en: "Attendee not found" }));
    await this.assertNoOverlap(madrasaId, dto.attendee_type, dto.attendee_id, dto.from_date, dto.to_date);

    const workingDays = dto.approve_now ? (await this.calendar.range(madrasaId, dto.from_date, dto.to_date)).workingDays : [];
    const { request, marked, skipped } = await this.repository.transaction(async (tx) => {
      const created = await this.repository.create(tx, {
        madrasaId,
        attendeeType: dto.attendee_type,
        attendeeId: dto.attendee_id,
        fromDate: dateOnly(dto.from_date),
        toDate: dateOnly(dto.to_date),
        leaveType: dto.leave_type,
        reason: dto.reason,
        status: dto.approve_now ? "APPROVED" : "PENDING",
        requestedVia: REQUESTED_VIA_ADMIN,
        requestedById: userId,
        ...(dto.approve_now ? { reviewedById: userId, reviewedAt: new Date() } : {}),
      });
      if (!dto.approve_now) return { request: created, marked: 0, skipped: 0 };
      const applied = await this.applyLeave(tx, created, workingDays, person.classId, userId);
      return { request: created, ...applied };
    });

    const item = await this.get(madrasaId, request.id);
    if (!dto.approve_now) return item;
    logger.info("Leave created and approved", { madrasaId, leaveId: request.id, marked, skipped });
    return { ...item, days_marked: marked, days_skipped: skipped };
  }

  async approve(madrasaId: number, id: number, userId: number | null, note?: string): Promise<ApproveResult> {
    const row = await this.repository.findById(madrasaId, id);
    if (!row) throw this.notFound();
    if (row.status !== "PENDING") throw this.wrongStatus(row.status);
    const person = await this.findPerson(madrasaId, row.attendeeType, row.attendeeId);
    const { workingDays } = await this.calendar.range(madrasaId, ymd(row.fromDate), ymd(row.toDate));

    const result = await this.repository.transaction(async (tx) => {
      const moved = await this.repository.transition(tx, madrasaId, id, ["PENDING"], {
        status: "APPROVED",
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNote: note || null,
      });
      if (moved.count === 0) throw this.wrongStatus(null);
      return this.applyLeave(tx, row, workingDays, person?.classId ?? null, userId);
    });
    logger.info("Leave approved", { madrasaId, leaveId: id, ...result });
    return { request: await this.get(madrasaId, id), days_marked: result.marked, days_skipped: result.skipped };
  }

  reject(madrasaId: number, id: number, userId: number | null, note: string): Promise<LeaveItem> {
    return this.close(madrasaId, id, "REJECTED", ["PENDING", "APPROVED"], userId, note);
  }

  cancel(madrasaId: number, id: number, userId: number | null, note?: string): Promise<LeaveItem> {
    return this.close(madrasaId, id, "CANCELLED", ["PENDING", "APPROVED"], userId, note);
  }

  /* ================= guardian ================= */

  /** Requests of the given (already ownership-checked) students, newest first. */
  async listForStudents(madrasaId: number, studentIds: number[]): Promise<LeaveItem[]> {
    if (!studentIds.length) return [];
    const rows = await this.repository.findAll(madrasaId, { attendeeType: "STUDENT", attendeeId: { in: studentIds } }, 200);
    return this.toItems(madrasaId, rows);
  }

  /** Caller must have verified that the guardian owns dto.student_id. */
  async createForGuardian(madrasaId: number, guardianId: number, dto: GuardianCreateLeaveDto): Promise<LeaveItem> {
    const earliest = addDays(todayLocal(), -GUARDIAN_BACKDATE_DAYS);
    const rangeErr = checkLeaveRange(dto.from_date, dto.to_date, MAX_GUARDIAN_LEAVE_DAYS, earliest);
    if (rangeErr) throw new BadRequestError(rangeMessage(rangeErr, MAX_GUARDIAN_LEAVE_DAYS));
    const person = await this.findPerson(madrasaId, "STUDENT", dto.student_id);
    if (!person) throw new NotFoundError(t({ bn: "শিক্ষার্থী পাওয়া যায়নি", en: "Student not found" }));
    await this.assertNoOverlap(madrasaId, "STUDENT", dto.student_id, dto.from_date, dto.to_date);

    const created = await this.repository.transaction((tx) =>
      this.repository.create(tx, {
        madrasaId,
        attendeeType: "STUDENT",
        attendeeId: dto.student_id,
        fromDate: dateOnly(dto.from_date),
        toDate: dateOnly(dto.to_date),
        leaveType: dto.leave_type,
        reason: dto.reason,
        status: "PENDING",
        requestedVia: REQUESTED_VIA_GUARDIAN,
        guardianId,
      }),
    );
    logger.info("Guardian leave request created", { madrasaId, leaveId: created.id, guardianId });
    return this.get(madrasaId, created.id);
  }

  /** A guardian may cancel a still-PENDING request of one of `ownStudentIds` that a guardian submitted. */
  async cancelForGuardian(madrasaId: number, guardianId: number, ownStudentIds: number[], id: number): Promise<LeaveItem> {
    const row = await this.repository.findById(madrasaId, id);
    if (!row || row.attendeeType !== "STUDENT" || !ownStudentIds.includes(row.attendeeId)) throw this.notFound();
    if (row.requestedVia !== REQUESTED_VIA_GUARDIAN) {
      throw new ForbiddenError(t({ bn: "এই আবেদনটি অফিস থেকে দেওয়া, বাতিল করতে অফিসে যোগাযোগ করুন", en: "This request was entered by the office; contact the office to cancel it" }));
    }
    if (row.status !== "PENDING") throw this.wrongStatus(row.status);
    const moved = await this.repository.transaction((tx) =>
      this.repository.transition(tx, madrasaId, id, ["PENDING"], {
        status: "CANCELLED",
        reviewNote: t({ bn: "অভিভাবক বাতিল করেছেন", en: "Cancelled by guardian" }),
        reviewedAt: new Date(),
      }),
    );
    if (moved.count === 0) throw this.wrongStatus(null);
    logger.info("Guardian leave request cancelled", { madrasaId, leaveId: id, guardianId });
    return this.get(madrasaId, id);
  }

  /* ================= internals ================= */

  /** Reject / cancel; an APPROVED request also loses the LEAVE rows it wrote. */
  private async close(
    madrasaId: number,
    id: number,
    to: "REJECTED" | "CANCELLED",
    allowedFrom: LeaveRequestStatus[],
    userId: number | null,
    note?: string,
  ): Promise<LeaveItem> {
    const row = await this.repository.findById(madrasaId, id);
    if (!row) throw this.notFound();
    if (!allowedFrom.includes(row.status)) throw this.wrongStatus(row.status);
    const previous = row.status;

    const removed = await this.repository.transaction(async (tx) => {
      const moved = await this.repository.transition(tx, madrasaId, id, [previous], {
        status: to,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNote: note || null,
      });
      if (moved.count === 0) throw this.wrongStatus(null);
      return previous === "APPROVED" ? this.removeLeave(tx, row, userId, note) : 0;
    });
    logger.info("Leave closed", { madrasaId, leaveId: id, status: to, removedRows: removed });
    return this.get(madrasaId, id);
  }

  /** Writes LEAVE on the working days of an approved request (inside the caller's transaction). */
  private async applyLeave(
    tx: Db,
    req: LeaveRequest,
    workingDays: string[],
    classId: number | null,
    userId: number | null,
  ): Promise<{ marked: number; skipped: number }> {
    const { madrasaId, attendeeType, attendeeId } = req;
    const existing = await this.loadRows(tx, req);
    const plan = planLeaveApproval(workingDays, existing);
    const reason = `leave #${req.id}: ${req.reason}`;
    const audits: AttendanceChangeInput[] = [];
    let createdCount = 0;

    if (plan.create.length) {
      const created = await this.repository.createAttendances(
        tx,
        plan.create.map((date) => ({
          madrasaId,
          attendeeType,
          attendeeId,
          classId: attendeeType === "STUDENT" ? classId : null,
          date: dateOnly(date),
          status: "LEAVE" as const,
          remarks: null,
          markedById: userId,
          source: LEAVE_ATTENDANCE_SOURCE,
        })),
      );
      for (const c of created) {
        audits.push({
          madrasaId,
          attendanceId: c.id,
          attendeeType,
          attendeeId,
          date: c.date,
          oldStatus: null,
          newStatus: "LEAVE",
          oldSource: null,
          newSource: LEAVE_ATTENDANCE_SOURCE,
          reason,
          via: "leave",
          changedById: userId,
        });
      }
      createdCount = created.length;
    }

    if (plan.convert.length) {
      await this.repository.updateAttendanceStatus(
        tx,
        plan.convert.map((r) => r.id),
        { status: "LEAVE", source: LEAVE_ATTENDANCE_SOURCE, markedById: userId },
      );
      for (const r of plan.convert) {
        audits.push({
          madrasaId,
          attendanceId: r.id,
          attendeeType,
          attendeeId,
          date: dateOnly(r.date),
          oldStatus: r.status,
          newStatus: "LEAVE",
          oldSource: r.source,
          newSource: LEAVE_ATTENDANCE_SOURCE,
          reason,
          via: "leave",
          changedById: userId,
        });
      }
    }

    await recordAttendanceChanges(tx, audits);
    return { marked: createdCount + plan.convert.length, skipped: plan.skipped.length };
  }

  /** Deletes the LEAVE rows an approved request wrote (inside the caller's transaction). */
  private async removeLeave(tx: Db, req: LeaveRequest, userId: number | null, note?: string): Promise<number> {
    const existing = await this.loadRows(tx, req);
    const remove = planLeaveRemoval(existing, ymd(req.fromDate), ymd(req.toDate));
    if (!remove.length) return 0;
    await this.repository.deleteAttendances(tx, req.madrasaId, remove.map((r) => r.id));
    await recordAttendanceChanges(
      tx,
      remove.map((r) => ({
        madrasaId: req.madrasaId,
        attendanceId: r.id,
        attendeeType: req.attendeeType,
        attendeeId: req.attendeeId,
        date: dateOnly(r.date),
        oldStatus: r.status,
        newStatus: null,
        oldSource: r.source,
        newSource: null,
        reason: `leave #${req.id}${note ? `: ${note}` : ""}`,
        via: "leave_cancel",
        changedById: userId,
      })),
    );
    return remove.length;
  }

  private async loadRows(tx: Db, req: LeaveRequest): Promise<ExistingRow[]> {
    const rows = await this.repository.findAttendanceInRange(
      tx,
      req.madrasaId,
      req.attendeeType,
      req.attendeeId,
      ymd(req.fromDate),
      ymd(req.toDate),
    );
    return rows.map((r) => ({ id: r.id, date: ymd(r.date), status: r.status, source: r.source }));
  }

  private async findPerson(madrasaId: number, type: AttendeeType, id: number): Promise<Person | null> {
    return (await this.repository.findPeople(madrasaId, type, [id]))[0] ?? null;
  }

  private async assertNoOverlap(madrasaId: number, type: AttendeeType, id: number, from: string, to: string) {
    const overlap = await this.repository.findOverlap(madrasaId, type, id, from, to);
    if (overlap) {
      throw new ConflictError(
        t({ bn: "এই সময়ের মধ্যে আরেকটি ছুটির আবেদন আগে থেকেই আছে", en: "Another leave request already covers part of this range" }),
        { leave_id: overlap.id, status: overlap.status },
      );
    }
  }

  private notFound() {
    return new NotFoundError(t({ bn: "ছুটির আবেদন পাওয়া যায়নি", en: "Leave request not found" }));
  }

  private wrongStatus(status: LeaveRequestStatus | null) {
    return new ConflictError(
      t({ bn: "আবেদনটির অবস্থা বদলে গেছে, এই কাজটি এখন করা যাবে না", en: "The request is no longer in a state that allows this action" }),
      status ? { status } : undefined,
    );
  }

  /** Rows -> wire items (names, class/roll, working-day count) with a fixed number of queries. */
  private async toItems(madrasaId: number, rows: LeaveRequest[]): Promise<LeaveItem[]> {
    if (!rows.length) return [];
    const idsByType = new Map<AttendeeType, Set<number>>();
    for (const r of rows) {
      if (!idsByType.has(r.attendeeType)) idsByType.set(r.attendeeType, new Set());
      idsByType.get(r.attendeeType)!.add(r.attendeeId);
    }
    const userIds = [
      ...new Set(rows.flatMap((r) => [r.requestedById, r.reviewedById]).filter((x): x is number => x !== null)),
    ];
    const guardianIds = [...new Set(rows.map((r) => r.guardianId).filter((x): x is number => x !== null))];
    const minFrom = rows.reduce((m, r) => (ymd(r.fromDate) < m ? ymd(r.fromDate) : m), ymd(rows[0].fromDate));
    const maxTo = rows.reduce((m, r) => (ymd(r.toDate) > m ? ymd(r.toDate) : m), ymd(rows[0].toDate));

    const [peopleLists, userNames, guardianNames, calendar] = await Promise.all([
      Promise.all([...idsByType].map(([type, ids]) => this.repository.findPeople(madrasaId, type, [...ids]))),
      this.repository.findUserNames(userIds),
      this.repository.findGuardianNames(madrasaId, guardianIds),
      this.calendar.range(madrasaId, minFrom, maxTo),
    ]);
    const people = new Map(peopleLists.flat().map((p) => [`${p.type}:${p.id}`, p]));

    return rows.map((r) => {
      const from = ymd(r.fromDate);
      const to = ymd(r.toDate);
      const person = people.get(`${r.attendeeType}:${r.attendeeId}`);
      const requestedBy =
        r.requestedVia === REQUESTED_VIA_GUARDIAN && r.guardianId
          ? guardianNames.get(r.guardianId) ?? null
          : r.requestedById
            ? userNames.get(r.requestedById) ?? null
            : null;
      return {
        id: r.id,
        attendee_type: r.attendeeType,
        attendee_id: r.attendeeId,
        attendee_name: person?.nameBn ?? null,
        ...(r.attendeeType === "STUDENT" ? { class_name: person?.className ?? null, roll: person?.roll ?? null } : {}),
        from_date: from,
        to_date: to,
        days: calendar.workingDays.filter((d) => d >= from && d <= to).length,
        leave_type: r.leaveType,
        reason: r.reason,
        status: r.status,
        requested_via: r.requestedVia,
        requested_by_name: requestedBy,
        reviewed_by_name: r.reviewedById ? userNames.get(r.reviewedById) ?? null : null,
        reviewed_at: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        review_note: r.reviewNote,
        created_at: r.createdAt.toISOString(),
      };
    });
  }
}

export const attendanceLeaveService = new AttendanceLeaveService();
