import type { AttendancePolicy, Prisma } from "@prisma/client";
import { prisma } from "../../../shared/database/prisma";

/**
 * Per-madrasa attendance policy (attendance_policies). Defaults mirror the
 * schema defaults and apply when a madrasa has no row yet.
 */

export const LEAVE_MODES = ["excluded", "present", "absent"] as const;
export type LeaveMode = (typeof LEAVE_MODES)[number];

export type Policy = Omit<AttendancePolicy, "id" | "madrasaId" | "createdAt" | "updatedAt" | "leaveMode"> & {
  leaveMode: LeaveMode;
};

export const DEFAULT_POLICY: Policy = {
  editWindowDays: 7,
  lateToAbsentCount: 0,
  leaveMode: "excluded",
  lowAttendancePercent: 75,
  consecutiveAbsentDays: 0,
  lastConsecutiveCheck: null,
  payrollDeductAbsent: true,
};

export const withDefaultPolicy = (row: Partial<AttendancePolicy> | null | undefined): Policy => {
  const merged = {
    ...DEFAULT_POLICY,
    ...(row ? Object.fromEntries(Object.entries(row).filter(([k, v]) => k in DEFAULT_POLICY && v !== undefined)) : {}),
  } as Policy;
  if (!LEAVE_MODES.includes(merged.leaveMode)) merged.leaveMode = "excluded";
  return merged;
};

/** Admin-facing shape (snake_case). */
export const toPolicyDto = (p: Policy) => ({
  edit_window_days: p.editWindowDays,
  late_to_absent_count: p.lateToAbsentCount,
  leave_mode: p.leaveMode,
  low_attendance_percent: p.lowAttendancePercent,
  consecutive_absent_days: p.consecutiveAbsentDays,
  payroll_deduct_absent: p.payrollDeductAbsent,
});

export class AttendancePolicyRepository {
  find(madrasaId: number) {
    return prisma.attendancePolicy.findUnique({ where: { madrasaId } });
  }

  upsert(madrasaId: number, data: Omit<Prisma.AttendancePolicyUncheckedCreateInput, "madrasaId">) {
    return prisma.attendancePolicy.upsert({
      where: { madrasaId },
      create: { ...data, madrasaId },
      update: data,
    });
  }

  listWhere(where: Prisma.AttendancePolicyWhereInput) {
    return prisma.attendancePolicy.findMany({ where });
  }

  setLastConsecutiveCheck(madrasaId: number, date: Date) {
    return prisma.attendancePolicy.updateMany({ where: { madrasaId }, data: { lastConsecutiveCheck: date } });
  }
}

export const attendancePolicyRepository = new AttendancePolicyRepository();

/** Effective policy of a madrasa (defaults when it has no row). */
export const getPolicy = async (madrasaId: number): Promise<Policy> =>
  withDefaultPolicy(await attendancePolicyRepository.find(madrasaId));
