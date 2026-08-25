import { ApiError, BadRequestError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { emailService } from "../../shared/notifications/email.service";
import { smsService } from "../../shared/notifications/sms.service";
import { platformSettingsService } from "../super-admin/platform-settings.service";
import { studentRepository } from "../students/student.repository";
import { teacherRepository } from "../teacher/teacher.repository";
import { resultPanelRepository } from "../ResultPanel/result-panel.repository";
import { billingService } from "../billing/billing.service";
import { notificationRepository, NotificationRepository } from "./notification.repository";
import {
  NotificationQueryDto,
  NotificationRecipient,
  NotificationSettingUpdateDto,
  SendNotificationRequestDto,
} from "./notification.dto";
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NotificationEventKey,
} from "./notification.constants";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

/** Replaces `{key}` tokens in a template with values from `vars`; a token
 * with no matching var is left untouched rather than silently blanked out,
 * so a typo in a template is obvious instead of producing a broken message. */
const renderTemplate = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));

export class NotificationService {
  constructor(private readonly repository: NotificationRepository = notificationRepository) {}

  /**
   * Sends a message to one or more recipients over SMS or Email. Every
   * recipient gets its own NotificationLog row (sent independently, so one
   * bad phone number/email doesn't block the rest of the batch) and its own
   * attempt at the underlying provider. A recipient may be a plain string
   * (message sent as-is) or `{ to, vars }`, in which case `message` is
   * rendered as a per-recipient template first (personalized bulk sends).
   */
  async send(madrasaId: number, sentById: number | undefined, dto: SendNotificationRequestDto) {
    if (!NOTIFICATION_CHANNELS.includes(dto.channel)) {
      throw new BadRequestError("channel must be SMS or EMAIL");
    }
    if (!Array.isArray(dto.recipients) || dto.recipients.length === 0) {
      throw new BadRequestError("recipients must be a non-empty array");
    }
    if (!dto.message || !dto.message.trim()) {
      throw new BadRequestError("message is required");
    }
    if (dto.channel === "EMAIL" && !dto.subject?.trim()) {
      throw new BadRequestError("subject is required for EMAIL");
    }

    // Resolved once per request (not per recipient) - the platform gateway
    // config rarely changes and this avoids a DB round trip per recipient
    // on a bulk send.
    const smsConfig = dto.channel === "SMS" ? await platformSettingsService.resolveSmsConfig() : null;
    const emailConfig =
      dto.channel === "EMAIL" ? await platformSettingsService.resolveEmailConfig() : null;

    const results = [];
    for (const raw of dto.recipients) {
      const recipient = typeof raw === "string" ? raw : raw.to;
      const message =
        typeof raw === "string" || !raw.vars ? dto.message : renderTemplate(dto.message, raw.vars);

      // Billing gate (PHASE 6/7/8/19/20): resolved per-recipient (not once
      // per batch) since a personalized template can render to a different
      // SMS segment count per recipient. Nothing is sent to the provider
      // until credit is atomically reserved - a rejection here never
      // touches the provider at all.
      let charge;
      try {
        charge = await billingService.chargeForSend(madrasaId, dto.channel, recipient, message);
      } catch (err) {
        const errorMessage = err instanceof BadRequestError ? err.message : "বিলিং যাচাই ব্যর্থ হয়েছে";
        await this.repository.create({
          madrasaId,
          channel: dto.channel,
          recipient,
          subject: dto.channel === "EMAIL" ? dto.subject : null,
          message,
          status: "FAILED",
          provider: null,
          errorMessage,
          sentById: sentById ?? null,
        });
        results.push({ recipient, status: "FAILED", error: errorMessage });
        continue;
      }

      try {
        const log = await this.repository.create({
          madrasaId,
          channel: dto.channel,
          recipient,
          subject: dto.channel === "EMAIL" ? dto.subject : null,
          message,
          status: "PENDING",
          sentById: sentById ?? null,
        });

        const outcome =
          dto.channel === "EMAIL"
            ? await emailService.send(
                {
                  to: recipient,
                  subject: dto.subject!,
                  html: message,
                  text: message,
                },
                emailConfig,
              )
            : await smsService.send({ to: recipient, message }, smsConfig);

        if (outcome.success) {
          await this.repository.markSent(log.id, outcome.provider);
          await billingService.finalizeSendSuccess(charge.usageLogId, outcome.provider);
          results.push({ recipient, status: "SENT", provider: outcome.provider });
        } else {
          await this.repository.markFailed(log.id, outcome.provider, outcome.errorMessage || "");
          await billingService.releaseSendFailure(
            madrasaId,
            dto.channel,
            charge.segmentCount,
            charge.usageLogId,
            outcome.errorMessage || "Provider rejected the message",
          );
          results.push({ recipient, status: "FAILED", error: outcome.errorMessage });
        }
      } catch (err) {
        logger.error(`Notification send failed for ${recipient}:`, err);
        await billingService.releaseSendFailure(
          madrasaId,
          dto.channel,
          charge.segmentCount,
          charge.usageLogId,
          (err as Error)?.message || "Unexpected error",
        );
        results.push({ recipient, status: "FAILED", error: "Unexpected error" });
      }
    }

    return {
      total: results.length,
      sent: results.filter((r) => r.status === "SENT").length,
      failed: results.filter((r) => r.status === "FAILED").length,
      results,
    };
  }

  async list(madrasaId: number, query: NotificationQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;
    const limit = query.limit ? Math.min(Number(query.limit), 200) : 50;

    try {
      return await this.repository.findMany(madrasaId, where, limit);
    } catch (err) {
      return friendlyFailure("listNotifications error:", err, "Failed to load notification history");
    }
  }

  /* ================= AUDIENCE RESOLUTION (Bulk Send) ================= */

  async getAudienceStudents(madrasaId: number, query: { sessionId?: string; classId?: string }) {
    const where: Record<string, unknown> = { madrasaId, isActive: 1, admissionStatus: "APPROVED" };
    if (query.sessionId) where.sessionId = Number(query.sessionId);
    if (query.classId) where.classId = Number(query.classId);

    const rows = await studentRepository.findMany(where as any);
    return rows
      .filter((s) => s.guardianPhone)
      .map((s) => ({ id: s.id, name: s.nameBn, roll: s.roll, phone: s.guardianPhone as string }));
  }

  async getAudienceTeachers(madrasaId: number) {
    const rows = await teacherRepository.findMany(madrasaId);
    return rows
      .filter((t) => t.isActive !== 0 && (t.phone || t.email))
      .map((t) => ({ id: t.id, name: t.nameBn, phone: t.phone, email: t.email }));
  }

  /** Per-student result data (own roll/GPA/grade) for a personalized "রেজাল্ট
   * পাঠান" bulk send - each recipient's `vars` carries their own marks. */
  async getAudienceResults(madrasaId: number, examId: number, classId: number) {
    const summaries = await resultPanelRepository.findResultSummaries(madrasaId, examId, classId);
    if (!summaries.length) return [];

    const studentIds = [...new Set(summaries.map((s) => s.studentId))];
    const students = await studentRepository.findMany({ id: { in: studentIds }, madrasaId } as any);
    const phoneById = new Map(students.map((s) => [s.id, s.guardianPhone]));
    const rollById = new Map(students.map((s) => [s.id, s.roll]));

    return summaries
      .filter((s) => phoneById.get(s.studentId))
      .map((s) => ({
        studentId: s.studentId,
        name: s.student?.nameBn || "",
        roll: rollById.get(s.studentId) ?? "",
        phone: phoneById.get(s.studentId) as string,
        gpa: s.average != null ? String(s.average) : "",
        grade: s.generalGrade || s.madrasaGrade || "",
        status: s.status || "",
      }));
  }

  /* ================= AUTO NOTIFICATION SETTINGS ================= */

  async getSettings(madrasaId: number) {
    const rows = await this.repository.findAllSettings(madrasaId);
    const byKey = new Map(rows.map((r) => [r.eventKey, r]));

    return NOTIFICATION_EVENTS.map((eventKey) => {
      const row = byKey.get(eventKey);
      return {
        eventKey,
        isEnabled: row ? !!row.isEnabled : true,
        template: row?.template || DEFAULT_NOTIFICATION_TEMPLATES[eventKey],
      };
    });
  }

  async updateSetting(madrasaId: number, eventKey: string, dto: NotificationSettingUpdateDto) {
    if (!NOTIFICATION_EVENTS.includes(eventKey as NotificationEventKey)) {
      throw new BadRequestError("Invalid event key");
    }
    const existing = await this.repository.findSetting(madrasaId, eventKey);

    return this.repository.upsertSetting(madrasaId, eventKey, {
      isEnabled:
        dto.isEnabled === undefined ? (existing ? existing.isEnabled : 1) : dto.isEnabled ? 1 : 0,
      template:
        dto.template?.trim() ||
        existing?.template ||
        DEFAULT_NOTIFICATION_TEMPLATES[eventKey as NotificationEventKey],
    });
  }

  /* ================= AUTO-TRIGGER (called from other modules) ================= */

  /** Fire-and-forget SMS for a business event (admission approved, student
   * info updated, fee payment recorded). Never throws - a notification
   * failure must never affect the underlying admission/update/payment. */
  async triggerEvent(
    madrasaId: number,
    eventKey: NotificationEventKey,
    phone: string | null | undefined,
    vars: Record<string, string | number>,
  ) {
    try {
      if (!phone) return;

      const setting = await this.repository.findSetting(madrasaId, eventKey);
      const enabled = setting ? !!setting.isEnabled : true;
      if (!enabled) return;

      const template = setting?.template || DEFAULT_NOTIFICATION_TEMPLATES[eventKey];
      const message = renderTemplate(template, vars);

      await this.send(madrasaId, undefined, { channel: "SMS", recipients: [phone], message });
    } catch (err) {
      logger.error(`triggerEvent(${eventKey}) failed:`, err);
    }
  }
}

export const notificationService = new NotificationService();
export type { NotificationRecipient };
