import { prisma } from "../../shared/database/prisma";

export interface ClaimedSms {
  id: number;
  madrasaId: number;
  recipient: string;
  message: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  studentId: number | null;
}

export class SmsQueueRepository {
  /**
   * Stale PROCESSING recovery: a worker that died mid-send leaves rows
   * locked. Puts them back to PENDING (or FAILED once attempts are spent).
   */
  async recoverStale(cutoff: Date): Promise<number> {
    return prisma.$executeRaw`
      UPDATE sms_queue
      SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED'::"SmsQueueStatus" ELSE 'PENDING'::"SmsQueueStatus" END,
          locked_at = NULL,
          next_attempt_at = NOW(),
          last_error = COALESCE(last_error, 'stale processing recovered'),
          updated_at = NOW()
      WHERE status = 'PROCESSING'::"SmsQueueStatus" AND locked_at < ${cutoff}
    `;
  }

  /**
   * Atomically claims up to `limit` due PENDING rows. FOR UPDATE SKIP LOCKED
   * makes this safe with several backend instances: each row is claimed by
   * exactly one worker. `attempts` is incremented at claim time.
   */
  claimBatch(limit: number): Promise<ClaimedSms[]> {
    return prisma.$queryRaw<ClaimedSms[]>`
      UPDATE sms_queue
      SET status = 'PROCESSING'::"SmsQueueStatus",
          locked_at = NOW(),
          attempts = attempts + 1,
          updated_at = NOW()
      WHERE id IN (
        SELECT id FROM sms_queue
        WHERE status = 'PENDING'::"SmsQueueStatus" AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at, id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id,
                madrasa_id AS "madrasaId",
                recipient,
                message,
                attempts,
                max_attempts AS "maxAttempts",
                created_at AS "createdAt",
                student_id AS "studentId"
    `;
  }

  /** Transitions are guarded by status = PROCESSING so a row that stale
   * recovery already handed to another worker is never overwritten. */
  markSent(id: number, at: Date) {
    return prisma.smsQueue.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "SENT", sentAt: at, lockedAt: null, lastError: null },
    });
  }

  markRetry(id: number, error: string, nextAttemptAt: Date) {
    return prisma.smsQueue.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "PENDING", lockedAt: null, lastError: error, nextAttemptAt },
    });
  }

  markFailed(id: number, error: string) {
    return prisma.smsQueue.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "FAILED", lockedAt: null, lastError: error },
    });
  }
}

export const smsQueueRepository = new SmsQueueRepository();
