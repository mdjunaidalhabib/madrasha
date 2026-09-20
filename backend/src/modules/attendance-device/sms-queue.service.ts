import { env } from "../../shared/config/env";
import { logger } from "../../shared/logger/logger";
import { notificationService } from "../notifications/notification.service";
import { maskPhone, sanitizeShortText } from "./device-secret.util";
import { ClaimedSms, smsQueueRepository, SmsQueueRepository } from "./sms-queue.repository";

export interface SmsWorkerOptions {
  batchSize: number;
  backoffBaseSeconds: number;
  backoffMaxSeconds: number;
  staleProcessingSeconds: number;
  maxAgeHours: number;
}

export const defaultSmsWorkerOptions = (): SmsWorkerOptions => ({
  batchSize: env.smsWorkerBatchSize,
  backoffBaseSeconds: env.smsBackoffBaseSeconds,
  backoffMaxSeconds: env.smsBackoffMaxSeconds,
  staleProcessingSeconds: env.smsStaleProcessingSeconds,
  maxAgeHours: env.smsMaxAgeHours,
});

/** Exponential backoff: base * 2^(attempts-1), capped. attempts is the count INCLUDING the one that just failed. */
export const computeBackoffSeconds = (attempts: number, baseSeconds: number, maxSeconds: number) =>
  Math.min(maxSeconds, baseSeconds * 2 ** Math.max(0, attempts - 1));

type Sender = Pick<typeof notificationService, "send">;

export interface WorkerRunResult {
  recovered: number;
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

/**
 * Sends queued attendance SMS. Delivery goes through NotificationService.send,
 * i.e. the existing billing gate (credit reserve/refund), SMS provider and
 * NotificationLog audit row - this worker only adds queueing, retry and dedupe.
 *
 * Delivery is at-least-once: if a process dies after the provider accepted the
 * SMS but before the row is marked SENT, stale recovery will retry it.
 */
export class SmsQueueService {
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: SmsQueueRepository = smsQueueRepository,
    private readonly sender: Sender = notificationService,
    private readonly options: () => SmsWorkerOptions = defaultSmsWorkerOptions,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** One pass. Single-flight per process: an overlapping tick returns null. */
  async runOnce(): Promise<WorkerRunResult | null> {
    if (this.running) return null;
    this.running = true;
    const result: WorkerRunResult = { recovered: 0, claimed: 0, sent: 0, retried: 0, failed: 0 };
    try {
      const opts = this.options();
      const cutoff = new Date(this.now().getTime() - opts.staleProcessingSeconds * 1000);
      result.recovered = await this.repository.recoverStale(cutoff);
      if (result.recovered > 0) logger.warn("SMS queue stale PROCESSING rows recovered", { count: result.recovered });

      const batch = await this.repository.claimBatch(opts.batchSize);
      result.claimed = batch.length;
      for (const item of batch) {
        const outcome = await this.processOne(item, opts);
        result[outcome]++;
      }
      return result;
    } catch (err) {
      logger.error("SMS queue worker pass failed", { reason: (err as Error)?.message });
      return result;
    } finally {
      this.running = false;
    }
  }

  private async processOne(item: ClaimedSms, opts: SmsWorkerOptions): Promise<"sent" | "retried" | "failed"> {
    const ageMs = this.now().getTime() - new Date(item.createdAt).getTime();
    if (ageMs > opts.maxAgeHours * 3_600_000) {
      await this.repository.markFailed(item.id, "expired");
      logger.warn("SMS queue item expired", { id: item.id, madrasaId: item.madrasaId });
      return "failed";
    }

    let error: string | null = null;
    try {
      const res = await this.sender.send(item.madrasaId, undefined, {
        channel: "SMS",
        recipients: [item.recipient],
        message: item.message,
      });
      const first = res.results[0];
      if (first && first.status === "SENT") {
        await this.repository.markSent(item.id, this.now());
        logger.info("SMS queue item sent", {
          id: item.id,
          madrasaId: item.madrasaId,
          phone: maskPhone(item.recipient),
          attempts: item.attempts,
        });
        return "sent";
      }
      error = sanitizeShortText(first?.error, 300) || "send failed";
    } catch (err) {
      error = sanitizeShortText((err as Error)?.message, 300) || "send error";
    }

    if (item.attempts >= item.maxAttempts) {
      await this.repository.markFailed(item.id, error);
      logger.warn("SMS queue item failed permanently", {
        id: item.id,
        madrasaId: item.madrasaId,
        phone: maskPhone(item.recipient),
        attempts: item.attempts,
        error,
      });
      return "failed";
    }

    const delay = computeBackoffSeconds(item.attempts, opts.backoffBaseSeconds, opts.backoffMaxSeconds);
    await this.repository.markRetry(item.id, error, new Date(this.now().getTime() + delay * 1000));
    logger.warn("SMS queue item will be retried", {
      id: item.id,
      madrasaId: item.madrasaId,
      phone: maskPhone(item.recipient),
      attempts: item.attempts,
      retryInSeconds: delay,
      error,
    });
    return "retried";
  }

  start(): void {
    if (this.timer || !env.smsWorkerEnabled) return;
    const interval = Math.max(1000, env.smsWorkerIntervalMs);
    this.timer = setInterval(() => void this.runOnce(), interval);
    this.timer.unref();
    logger.info("SMS queue worker started", { intervalMs: interval });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export const smsQueueService = new SmsQueueService();
