import type { AttendanceDevice, DeviceEnrollmentStatus } from "@prisma/client";
import { BadRequestError, NotFoundError, ValidationError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { t } from "../../shared/i18n";
import {
  COMMANDS_RECHECK_MS,
  ENROLLMENT_TTL_SEC,
  OFFLINE_AFTER_POLL_INTERVALS,
  PersonType,
} from "./attendance-device.constants";
import { CreateEnrollmentDto, EnrollmentReportDto } from "./attendance-device.dto";
import { deviceUserName, normalizeCardNumber } from "./attendance-device-rules";
import {
  attendanceDeviceEnrollmentRepository,
  AttendanceDeviceEnrollmentRepository,
  EnrollmentRow,
  OPEN_ENROLLMENT_STATUSES,
} from "./attendance-device-enrollment.repository";
import {
  attendanceDevicePeopleRepository,
  AttendanceDevicePeopleRepository,
  PersonRef,
} from "./attendance-device-people.repository";
import { attendanceDevicePeopleService, AttendanceDevicePeopleService } from "./attendance-device-people.service";
import { sanitizeShortText } from "./device-secret.util";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === "P2002";

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface EnrollmentReportResult {
  ok: boolean;
  status: string;
  message?: string;
  user?: { pin: string; name: string; card: string | null };
}

/**
 * RFID card enrollment ("tap the card on the machine"): an admin opens a
 * person, the device's connector long-polls GET /connector/commands, writes
 * the person to the K40, waits for a swipe and reports it back.
 */
export class AttendanceDeviceEnrollmentService {
  constructor(
    private readonly repository: AttendanceDeviceEnrollmentRepository = attendanceDeviceEnrollmentRepository,
    private readonly people: AttendanceDevicePeopleService = attendanceDevicePeopleService,
    private readonly peopleRepository: AttendanceDevicePeopleRepository = attendanceDevicePeopleRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  private connectorOnline(device: EnrollmentRow["device"]): boolean {
    if (!device.lastSeenAt) return false;
    return this.now().getTime() - device.lastSeenAt.getTime() <= OFFLINE_AFTER_POLL_INTERVALS * device.pollIntervalSec * 1000;
  }

  private async personName(madrasaId: number, row: EnrollmentRow): Promise<string | null> {
    const person = await this.peopleRepository.findPerson(madrasaId, { type: row.attendeeType, id: row.attendeeId });
    return person?.nameBn ?? null;
  }

  private toDto(row: EnrollmentRow, personName: string | null) {
    return {
      id: row.id,
      device_id: row.deviceId,
      device_name: row.device.name,
      attendee_type: row.attendeeType,
      attendee_id: row.attendeeId,
      person_name: personName,
      device_user_id: row.deviceUserId,
      status: row.status.toLowerCase(),
      card_number: row.cardNumber,
      message: row.message,
      expires_at: iso(row.expiresAt),
      created_at: iso(row.createdAt),
      completed_at: iso(row.completedAt),
      connector_online: this.connectorOnline(row.device),
    };
  }

  /** Marks an open-but-timed-out row EXPIRED and returns the fresh row. */
  private async lazyExpire(madrasaId: number, row: EnrollmentRow): Promise<EnrollmentRow> {
    if (OPEN_ENROLLMENT_STATUSES.includes(row.status) && row.expiresAt.getTime() <= this.now().getTime()) {
      await this.repository.transition(madrasaId, row.id, OPEN_ENROLLMENT_STATUSES, { status: "EXPIRED" });
      return (await this.repository.findById(madrasaId, row.id)) ?? row;
    }
    return row;
  }

  /* ================= admin ================= */

  private async pickDevice(madrasaId: number, deviceId?: number | null): Promise<AttendanceDevice> {
    const active = await this.repository.findActiveDevices(madrasaId);
    if (deviceId) {
      const device = active.find((d) => d.id === deviceId);
      if (!device) throw new BadRequestError(t({ bn: "সক্রিয় ডিভাইসটি পাওয়া যায়নি", en: "Active device not found" }));
      return device;
    }
    if (active.length === 0) {
      throw new BadRequestError(t({ bn: "কোনো সক্রিয় ডিভাইস নেই। আগে একটি ডিভাইস যোগ করুন", en: "No active device. Add a device first" }));
    }
    if (active.length > 1) {
      throw new BadRequestError(t({ bn: "একাধিক ডিভাইস আছে, কোন ডিভাইসে কার্ড দেবেন তা বেছে নিন (device_id)", en: "Several devices exist; choose one (device_id)" }));
    }
    return active[0];
  }

  async create(madrasaId: number, userId: number | null, dto: CreateEnrollmentDto) {
    const ref: PersonRef = { type: dto.attendee_type, id: dto.attendee_id };
    const device = await this.pickDevice(madrasaId, dto.device_id);
    const person = await this.people.requireEligiblePerson(madrasaId, ref);
    const map = await this.people.ensureMap(madrasaId, ref);

    await this.repository.cancelOpenForDevice(madrasaId, device.id, "replaced by a new enrollment");
    const row = await this.repository.create({
      madrasaId,
      deviceId: device.id,
      attendeeType: ref.type,
      attendeeId: ref.id,
      deviceUserId: map.deviceUserId,
      status: "PENDING",
      expiresAt: new Date(this.now().getTime() + ENROLLMENT_TTL_SEC * 1000),
      createdById: userId,
    });
    logger.info("Attendance card enrollment started", { madrasaId, deviceId: device.id, enrollmentId: row.id, type: ref.type, personId: ref.id });
    return this.toDto(row, person.nameBn);
  }

  async get(madrasaId: number, id: number) {
    const found = await this.repository.findById(madrasaId, id);
    if (!found) throw new NotFoundError(t({ bn: "এনরোলমেন্ট পাওয়া যায়নি", en: "Enrollment not found" }));
    const row = await this.lazyExpire(madrasaId, found);
    return this.toDto(row, await this.personName(madrasaId, row));
  }

  async cancel(madrasaId: number, id: number) {
    const found = await this.repository.findById(madrasaId, id);
    if (!found) throw new NotFoundError(t({ bn: "এনরোলমেন্ট পাওয়া যায়নি", en: "Enrollment not found" }));
    await this.repository.transition(madrasaId, id, OPEN_ENROLLMENT_STATUSES, { status: "CANCELLED", message: "cancelled by admin" });
    const row = (await this.repository.findById(madrasaId, id)) ?? found;
    return this.toDto(row, await this.personName(madrasaId, row));
  }

  /* ================= connector ================= */

  /**
   * Long-poll: returns as soon as this device has a PENDING, unexpired
   * enrollment, or after `waitSec`. Does not change the enrollment status.
   */
  async commands(device: AttendanceDevice, waitSec: number, isAborted: () => boolean = () => false) {
    const madrasaId = device.madrasaId;
    const deadline = this.now().getTime() + waitSec * 1000;
    await this.repository.expireStale(madrasaId, this.now(), device.id);

    let row: EnrollmentRow | null = null;
    for (;;) {
      row = await this.repository.findPendingForDevice(madrasaId, device.id, this.now());
      if (row || isAborted()) break;
      const left = deadline - this.now().getTime();
      if (left <= 0) break;
      await this.sleep(Math.min(COMMANDS_RECHECK_MS, left));
    }

    let enrollment = null;
    if (row) {
      const ref = { type: row.attendeeType as PersonType, id: row.attendeeId };
      const [person, map] = await Promise.all([
        this.peopleRepository.findPerson(madrasaId, ref),
        this.peopleRepository.findMapByPerson(madrasaId, ref),
      ]);
      const pin = map?.deviceUserId ?? row.deviceUserId;
      enrollment = {
        id: row.id,
        device_user_id: pin,
        name: deviceUserName(ref.type, person?.nameEn, pin),
        card_number: map?.cardNumber ?? null,
        attendee_type: row.attendeeType,
        expires_at: row.expiresAt.toISOString(),
      };
    }
    return {
      enrollment,
      users_version: await this.people.usersVersion(madrasaId),
      server_time: this.now().toISOString(),
    };
  }

  async report(device: AttendanceDevice, id: number, dto: EnrollmentReportDto): Promise<EnrollmentReportResult> {
    const madrasaId = device.madrasaId;
    const row = await this.repository.findForDevice(madrasaId, device.id, id);
    if (!row) throw new NotFoundError(t({ bn: "এনরোলমেন্ট পাওয়া যায়নি", en: "Enrollment not found" }));
    const message = sanitizeShortText(dto.message, 200) || null;
    const closed = (status: DeviceEnrollmentStatus): EnrollmentReportResult => ({ ok: false, status: status.toLowerCase() });

    if (!OPEN_ENROLLMENT_STATUSES.includes(row.status)) return closed(row.status);

    if (dto.status === "waiting") {
      if (row.expiresAt.getTime() <= this.now().getTime()) {
        await this.repository.transition(madrasaId, id, OPEN_ENROLLMENT_STATUSES, { status: "EXPIRED" });
        return { ok: false, status: "expired" };
      }
      const res = await this.repository.transition(madrasaId, id, OPEN_ENROLLMENT_STATUSES, {
        status: "WAITING",
        ...(message ? { message } : {}),
      });
      if (res.count === 0) return this.currentStatus(madrasaId, id);
      return { ok: true, status: "waiting" };
    }

    if (dto.status === "failed" || dto.status === "expired") {
      const status = dto.status === "failed" ? "FAILED" : "EXPIRED";
      const res = await this.repository.transition(madrasaId, id, OPEN_ENROLLMENT_STATUSES, { status, message });
      if (res.count === 0) return this.currentStatus(madrasaId, id);
      logger.info("Attendance card enrollment ended", { madrasaId, deviceId: device.id, enrollmentId: id, status });
      return { ok: true, status: dto.status };
    }

    // captured
    const card = normalizeCardNumber(dto.card_number);
    if (!card) {
      throw new ValidationError(t({ bn: "কার্ড নম্বর সঠিক নয়", en: "card_number is invalid" }), {
        fieldErrors: { card_number: [t({ bn: "শুধু ১-২০টি অঙ্ক, ০ নয়", en: "1-20 digits, not 0" })] },
      });
    }
    const ref: PersonRef = { type: row.attendeeType as PersonType, id: row.attendeeId };
    const holder = await this.peopleRepository.findMapByCard(madrasaId, card);
    if (holder && !(holder.person?.type === ref.type && holder.person.id === ref.id)) {
      return this.failCardInUse(madrasaId, id, card, holder.person?.nameBn ?? holder.deviceUserId);
    }

    const map = await this.people.ensureMap(madrasaId, ref);
    try {
      const done = await this.repository.transaction(async (tx) => {
        const res = await this.repository.transition(
          madrasaId,
          id,
          OPEN_ENROLLMENT_STATUSES,
          { status: "COMPLETED", cardNumber: card, completedAt: this.now(), message },
          tx,
        );
        if (res.count === 0) return false;
        await tx.attendanceDeviceUserMap.updateMany({ where: { id: map.id, madrasaId }, data: { cardNumber: card } });
        return true;
      });
      if (!done) return this.currentStatus(madrasaId, id);
    } catch (err) {
      if (isUniqueViolation(err)) return this.failCardInUse(madrasaId, id, card, null);
      throw err;
    }

    const person = await this.peopleRepository.findPerson(madrasaId, ref);
    logger.info("Attendance card enrolled", { madrasaId, deviceId: device.id, enrollmentId: id, type: ref.type, personId: ref.id });
    return {
      ok: true,
      status: "completed",
      user: { pin: map.deviceUserId, name: deviceUserName(ref.type, person?.nameEn, map.deviceUserId), card },
    };
  }

  private async failCardInUse(madrasaId: number, id: number, card: string, holderName: string | null) {
    const message = sanitizeShortText(holderName ? `card already used by ${holderName}` : "card already used by another person", 200);
    await this.repository.transition(madrasaId, id, OPEN_ENROLLMENT_STATUSES, { status: "FAILED", cardNumber: card, message });
    logger.info("Attendance card enrollment failed: card in use", { madrasaId, enrollmentId: id });
    return { ok: false, status: "failed", message: message ?? undefined };
  }

  private async currentStatus(madrasaId: number, id: number): Promise<EnrollmentReportResult> {
    const fresh = await this.repository.findById(madrasaId, id);
    return { ok: false, status: (fresh?.status ?? "EXPIRED").toLowerCase() };
  }
}

export const attendanceDeviceEnrollmentService = new AttendanceDeviceEnrollmentService();
