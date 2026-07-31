import { ApiError, BadRequestError } from "../../shared/errors";
import { logger } from "../../shared/logger/logger";
import { emailService } from "../../shared/notifications/email.service";
import { smsService } from "../../shared/notifications/sms.service";
import {
  notificationRepository,
  NotificationRepository,
} from "./notification.repository";
import { SendNotificationRequestDto, NotificationQueryDto } from "./notification.dto";
import { NOTIFICATION_CHANNELS } from "./notification.constants";

const friendlyFailure = (logTag: string, err: unknown, friendlyMessage: string): never => {
  logger.error(logTag, err);
  throw new ApiError(friendlyMessage, 500);
};

export class NotificationService {
  constructor(private readonly repository: NotificationRepository = notificationRepository) {}

  /**
   * Sends the same message to one or more recipients over SMS or Email.
   * Every recipient gets its own NotificationLog row (sent independently,
   * so one bad phone number/email doesn't block the rest of the batch)
   * and its own attempt at the underlying provider.
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

    const results = [];
    for (const recipient of dto.recipients) {
      try {
        const log = await this.repository.create({
          madrasaId,
          channel: dto.channel,
          recipient,
          subject: dto.channel === "EMAIL" ? dto.subject : null,
          message: dto.message,
          status: "PENDING",
          sentById: sentById ?? null,
        });

        const outcome =
          dto.channel === "EMAIL"
            ? await emailService.send({
                to: recipient,
                subject: dto.subject!,
                html: dto.message,
                text: dto.message,
              })
            : await smsService.send({ to: recipient, message: dto.message });

        if (outcome.success) {
          await this.repository.markSent(log.id, outcome.provider);
          results.push({ recipient, status: "SENT", provider: outcome.provider });
        } else {
          await this.repository.markFailed(log.id, outcome.provider, outcome.errorMessage || "");
          results.push({ recipient, status: "FAILED", error: outcome.errorMessage });
        }
      } catch (err) {
        logger.error(`Notification send failed for ${recipient}:`, err);
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
}

export const notificationService = new NotificationService();
