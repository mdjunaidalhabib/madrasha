import { DeviceEnrollmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";

export const OPEN_ENROLLMENT_STATUSES: DeviceEnrollmentStatus[] = ["PENDING", "WAITING"];

const enrollmentSelect = {
  id: true,
  madrasaId: true,
  deviceId: true,
  attendeeType: true,
  attendeeId: true,
  deviceUserId: true,
  status: true,
  cardNumber: true,
  message: true,
  expiresAt: true,
  completedAt: true,
  createdAt: true,
  device: { select: { id: true, name: true, lastSeenAt: true, pollIntervalSec: true } },
} satisfies Prisma.AttendanceDeviceEnrollmentSelect;

export type EnrollmentRow = Prisma.AttendanceDeviceEnrollmentGetPayload<{ select: typeof enrollmentSelect }>;

/** "Tap the card" enrollment sessions. Every query is scoped by madrasaId (and deviceId for the connector). */
export class AttendanceDeviceEnrollmentRepository {
  findActiveDevices(madrasaId: number) {
    return prisma.attendanceDevice.findMany({ where: { madrasaId, isActive: true }, orderBy: { id: "asc" } });
  }

  findById(madrasaId: number, id: number): Promise<EnrollmentRow | null> {
    return prisma.attendanceDeviceEnrollment.findFirst({ where: { id, madrasaId }, select: enrollmentSelect });
  }

  findForDevice(madrasaId: number, deviceId: number, id: number): Promise<EnrollmentRow | null> {
    return prisma.attendanceDeviceEnrollment.findFirst({ where: { id, madrasaId, deviceId }, select: enrollmentSelect });
  }

  /** Newest PENDING, unexpired enrollment of a device (the connector's next command). */
  findPendingForDevice(madrasaId: number, deviceId: number, now: Date): Promise<EnrollmentRow | null> {
    return prisma.attendanceDeviceEnrollment.findFirst({
      where: { madrasaId, deviceId, status: "PENDING", expiresAt: { gt: now } },
      orderBy: { id: "desc" },
      select: enrollmentSelect,
    });
  }

  create(data: Prisma.AttendanceDeviceEnrollmentUncheckedCreateInput): Promise<EnrollmentRow> {
    return prisma.attendanceDeviceEnrollment.create({ data, select: enrollmentSelect });
  }

  /** Cancels every open enrollment of a device (only one session per device at a time). */
  cancelOpenForDevice(madrasaId: number, deviceId: number, message: string) {
    return prisma.attendanceDeviceEnrollment.updateMany({
      where: { madrasaId, deviceId, status: { in: OPEN_ENROLLMENT_STATUSES } },
      data: { status: "CANCELLED", message },
    });
  }

  /** Lazy expiry of open sessions whose time is up. */
  expireStale(madrasaId: number, now: Date, deviceId?: number) {
    return prisma.attendanceDeviceEnrollment.updateMany({
      where: {
        madrasaId,
        ...(deviceId ? { deviceId } : {}),
        status: { in: OPEN_ENROLLMENT_STATUSES },
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });
  }

  /** Conditional transition: only applies while the row is still in one of `from`. */
  transition(
    madrasaId: number,
    id: number,
    from: DeviceEnrollmentStatus[],
    data: Prisma.AttendanceDeviceEnrollmentUncheckedUpdateManyInput,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return db.attendanceDeviceEnrollment.updateMany({ where: { id, madrasaId, status: { in: from } }, data });
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn, { maxWait: 10_000, timeout: 20_000 });
  }
}

export const attendanceDeviceEnrollmentRepository = new AttendanceDeviceEnrollmentRepository();
