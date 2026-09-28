import crypto from "crypto";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors";
import { kioskRepository, KioskRepository } from "./kiosk.repository";
import {
  CreateKioskDeviceResultDto,
  KioskDeviceDto,
  KioskScanResultDto,
  KioskScanStudentDto,
} from "./kiosk.dto";
import { t } from "../../shared/i18n";

/** Date-only "today", truncated to midnight UTC - same convention
 * attendance.service.ts's parseDateOnly relies on for the unique
 * (madrasaId, attendeeType, attendeeId, date) constraint to match. */
const todayDateOnly = (): Date => new Date(new Date().toISOString().slice(0, 10));

const toScanStudentDto = (student: {
  id: number;
  nameBn: string;
  roll: number;
  classId: number;
  image: string | null;
}): KioskScanStudentDto => ({
  id: student.id,
  name_bn: student.nameBn,
  roll: student.roll,
  class_id: student.classId,
  image: student.image,
});

export class KioskService {
  constructor(private readonly repository: KioskRepository = kioskRepository) {}

  async scanCard(madrasaId: number, cardUid: string): Promise<KioskScanResultDto> {
    const uid = String(cardUid || "").trim();
    if (!uid) throw new BadRequestError(t({ bn: "card_uid আবশ্যক", en: "card_uid is required", ar: "card_uid مطلوب" }));

    const student = await this.repository.findStudentByCardUid(madrasaId, uid);
    // roll is always non-null here since the repository query is scoped to
    // admissionStatus APPROVED (see kiosk.repository.ts). Rebuilt as a new
    // object (rather than passing `student` through as-is) because TS
    // doesn't carry a nested-property null-check into the containing
    // object's type for a later call.
    if (!student || student.roll == null) throw new NotFoundError(t({ bn: "কার্ড শনাক্ত হয়নি", en: "Card not recognized", ar: "لم يتم التعرف على البطاقة" }));

    return this.markScan(madrasaId, { ...student, roll: student.roll }, "card");
  }

  async scanFingerprint(madrasaId: number, fingerprintId: string): Promise<KioskScanResultDto> {
    const fid = String(fingerprintId || "").trim();
    if (!fid) throw new BadRequestError(t({ bn: "fingerprint_id আবশ্যক", en: "fingerprint_id is required", ar: "fingerprint_id مطلوب" }));

    const student = await this.repository.findStudentByFingerprintId(madrasaId, fid);
    // roll is always non-null here since the repository query is scoped to
    // admissionStatus APPROVED (see kiosk.repository.ts). Rebuilt as a new
    // object (rather than passing `student` through as-is) because TS
    // doesn't carry a nested-property null-check into the containing
    // object's type for a later call.
    if (!student || student.roll == null) throw new NotFoundError(t({ bn: "আঙুলের ছাপ শনাক্ত হয়নি", en: "Fingerprint not recognized", ar: "لم يتم التعرف على البصمة" }));

    return this.markScan(madrasaId, { ...student, roll: student.roll }, "fingerprint");
  }

  private async markScan(
    madrasaId: number,
    student: { id: number; nameBn: string; roll: number; classId: number; image: string | null },
    source: "card" | "fingerprint",
  ): Promise<KioskScanResultDto> {
    const date = todayDateOnly();
    const existing = await this.repository.findTodayAttendance(madrasaId, student.id, date);

    if (existing && existing.status === "PRESENT") {
      return { alreadyMarked: true, student: toScanStudentDto(student) };
    }

    await this.repository.markPresent(madrasaId, student.id, student.classId, date, source);
    return { alreadyMarked: false, student: toScanStudentDto(student) };
  }

  async createDevice(madrasaId: number, name: string): Promise<CreateKioskDeviceResultDto> {
    const deviceName = String(name || "").trim();
    if (!deviceName) throw new BadRequestError(t({ bn: "নাম আবশ্যক", en: "name is required", ar: "الاسم مطلوب" }));

    const rawKey = crypto.randomBytes(24).toString("hex");
    const apiKeyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const device = await this.repository.createDevice(madrasaId, deviceName, apiKeyHash);
    // rawKey is returned ONLY here - it is never stored or shown again.
    return { id: device.id, name: device.name, rawKey };
  }

  async listDevices(madrasaId: number): Promise<KioskDeviceDto[]> {
    const devices = await this.repository.listDevices(madrasaId);
    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      isActive: d.isActive,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
    }));
  }

  async setDeviceActive(madrasaId: number, id: number, isActive: boolean) {
    const result = await this.repository.setDeviceActive(madrasaId, id, isActive);
    if (result.count === 0) throw new NotFoundError(t({ bn: "কিয়স্ক ডিভাইস পাওয়া যায়নি", en: "Kiosk device not found", ar: "لم يتم العثور على جهاز الكشك" }));
    return result.count;
  }

  async deleteDevice(madrasaId: number, id: number) {
    const result = await this.repository.deleteDevice(madrasaId, id);
    if (result.count === 0) throw new NotFoundError(t({ bn: "কিয়স্ক ডিভাইস পাওয়া যায়নি", en: "Kiosk device not found", ar: "لم يتم العثور على جهاز الكشك" }));
    return result.count;
  }

  /** Assigns an RFID/NFC card UID to a student for kiosk attendance
   * scanning. Uniqueness across students is enforced by the DB (P2002),
   * translated to a friendly ConflictError here. */
  async assignStudentCard(madrasaId: number, studentId: number, cardUid: unknown) {
    const uid = typeof cardUid === "string" ? cardUid.trim() : "";
    if (!uid) throw new BadRequestError(t({ bn: "card_uid আবশ্যক", en: "card_uid is required", ar: "card_uid مطلوب" }));

    try {
      const result = await this.repository.setStudentCardUid(madrasaId, studentId, uid);
      if (result.count === 0) throw new NotFoundError(t({ bn: "শিক্ষার্থী পাওয়া যায়নি", en: "Student not found", ar: "لم يتم العثور على الطالب" }));
      return result.count;
    } catch (err) {
      if ((err as any)?.code === "P2002") {
        throw new ConflictError(t({ bn: "এই কার্ডটি অন্য শিক্ষার্থীর সাথে যুক্ত আছে", en: "This card is linked to another student", ar: "هذه البطاقة مرتبطة بطالب آخر" }));
      }
      throw err;
    }
  }
}

export const kioskService = new KioskService();
