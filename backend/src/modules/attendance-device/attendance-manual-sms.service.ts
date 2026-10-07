import type { AttendanceStatus, AttendeeType } from "@prisma/client";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/logger/logger";
import { statusWord } from "./attendance-device-rules";
import {
  attendanceDevicePeopleRepository,
  AttendanceDevicePeopleRepository,
} from "./attendance-device-people.repository";
import {
  attendanceDeviceSettingsService,
  AttendanceDeviceSettingsService,
} from "./attendance-device-settings.service";
import { attendanceDeviceIngestService, AttendanceDeviceIngestService } from "./attendance-device-ingest.service";
import { localDateString } from "./time.util";

export interface ManualMarkChange {
  attendanceId: number;
  attendeeType: AttendeeType;
  attendeeId: number;
  newStatus: AttendanceStatus;
}

/**
 * Guardian SMS for attendance marked by hand, so a class marked on paper gets
 * the same SMS as a class with the device. Opt-in (settings.manualSms) on top
 * of the per-event অটো নোটিফিকেশন switch; students only; today only (the
 * shared enqueue path refuses other days). Same dedupe key as device SMS, so a
 * student who also punched never gets the same SMS twice. Never throws.
 */
export class AttendanceManualSmsService {
  constructor(
    private readonly settings: AttendanceDeviceSettingsService = attendanceDeviceSettingsService,
    private readonly people: AttendanceDevicePeopleRepository = attendanceDevicePeopleRepository,
    private readonly ingest: AttendanceDeviceIngestService = attendanceDeviceIngestService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** `date` = the marked day (YYYY-MM-DD); a past or corrected day never sends SMS. */
  async notify(madrasaId: number, date: string, changes: ManualMarkChange[]): Promise<number> {
    try {
      const at = this.now();
      if (date !== localDateString(at, env.attendanceTimezone)) return 0;
      const relevant = changes.filter((c) => c.attendeeType === "STUDENT" && c.newStatus !== "LEAVE");
      if (relevant.length === 0) return 0;
      const rules = await this.settings.getRules(madrasaId);
      if (!rules.manualSms) return 0;

      const students = new Map(
        (await this.people.findStudents(madrasaId, [...new Set(relevant.map((c) => c.attendeeId))])).map((p) => [p.id, p]),
      );
      const getContext = this.ingest.smsContextLoader(madrasaId);
      let queued = 0;
      for (const c of relevant) {
        const student = students.get(c.attendeeId);
        if (!student?.eligible) continue;
        const r =
          c.newStatus === "ABSENT"
            ? await this.ingest.enqueueStudentSms(madrasaId, "absent", student, at, c.attendanceId, getContext)
            : await this.ingest.enqueueStudentSms(madrasaId, "present", student, at, c.attendanceId, getContext, {
                status: statusWord(c.newStatus),
              });
        if (r === "enqueued") queued++;
      }
      if (queued > 0) logger.info("Manual attendance SMS enqueued", { madrasaId, queued });
      return queued;
    } catch (err) {
      logger.error("Manual attendance SMS failed", { madrasaId, reason: (err as Error)?.message });
      return 0;
    }
  }
}

export const attendanceManualSmsService = new AttendanceManualSmsService();
