import { Server } from "http";
import { prisma } from "../shared/database/prisma";
import { logger } from "../shared/logger/logger";
import { trashService } from "../modules/trash/trash.service";
import { activityRepository } from "../modules/activity/activity.repository";
import { ACTIVITY_LOG_RETENTION_DAYS } from "../modules/activity/activity.constants";
import { billingService } from "../modules/billing/billing.service";
import { authRepository } from "../modules/auth/auth.repository";
import { feeService } from "../modules/fee/fee.service";

/**
 * Verifies the database is reachable at boot and logs the outcome.
 * Intentionally non-fatal on failure (same as before this refactor,
 * where the server just started and let individual requests fail) -
 * this only adds earlier visibility into a misconfigured DB, it does
 * not change whether the process starts.
 */
export const verifyDatabaseConnection = async (): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Database connection verified");
  } catch (error) {
    logger.error("Database connection check failed - server will still start", error);
  }
};

const TRASH_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const TRASH_PURGE_INITIAL_DELAY_MS = 30 * 1000;

const runTrashPurge = async (): Promise<void> => {
  try {
    const result = await trashService.purgeExpired();
    const total = Object.values(result).reduce((sum, count) => sum + count, 0);
    if (total) logger.info("Trash auto-purge complete", result);
  } catch (error) {
    logger.error("Trash auto-purge failed", error);
  }
};

/**
 * Permanently removes anything left in Trash past the 7-day retention
 * window (see trash.service.ts). Runs once shortly after boot, then on a
 * fixed interval — there's no cron library in this codebase, so a plain
 * `setInterval` does the job. `.unref()` so this timer never keeps the
 * process alive on its own during shutdown.
 */
export const startTrashPurgeScheduler = (): void => {
  setTimeout(runTrashPurge, TRASH_PURGE_INITIAL_DELAY_MS).unref();
  setInterval(runTrashPurge, TRASH_PURGE_INTERVAL_MS).unref();
};

const ACTIVITY_LOG_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ACTIVITY_LOG_PURGE_INITIAL_DELAY_MS = 45 * 1000;

const runActivityLogPurge = async (): Promise<void> => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ACTIVITY_LOG_RETENTION_DAYS);
    const result = await activityRepository.purgeOlderThan(cutoff);
    if (result.count) logger.info("Activity log auto-purge complete", { deleted: result.count });
  } catch (error) {
    logger.error("Activity log auto-purge failed", error);
  }
};

/**
 * Permanently removes activity log rows past the retention window
 * (ACTIVITY_LOG_RETENTION_DAYS, see activity.constants.ts). Same
 * setInterval pattern as startTrashPurgeScheduler - no cron library here.
 */
export const startActivityLogPurgeScheduler = (): void => {
  setTimeout(runActivityLogPurge, ACTIVITY_LOG_PURGE_INITIAL_DELAY_MS).unref();
  setInterval(runActivityLogPurge, ACTIVITY_LOG_PURGE_INTERVAL_MS).unref();
};

const MESSAGE_SUBSCRIPTION_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MESSAGE_SUBSCRIPTION_SYNC_INITIAL_DELAY_MS = 20 * 1000;

const runMessageSubscriptionExpirySync = async (): Promise<void> => {
  try {
    const result = await billingService.syncExpiredSubscriptions();
    if (result.count) logger.info("SMS/Email subscription expiry sync complete", { expired: result.count });
  } catch (error) {
    logger.error("SMS/Email subscription expiry sync failed", error);
  }
};

/**
 * Keeps MessageSubscription.status accurate for reporting/dashboards
 * (PHASE 6/28) - purely cosmetic/reporting, NOT the access gate. Every
 * actual send still checks `expiryDate` directly and in real time
 * (see billing.service.ts#chargeForSend), so a delayed sync here can
 * never let an expired tenant send.
 */
export const startMessageSubscriptionExpirySync = (): void => {
  setTimeout(runMessageSubscriptionExpirySync, MESSAGE_SUBSCRIPTION_SYNC_INITIAL_DELAY_MS).unref();
  setInterval(runMessageSubscriptionExpirySync, MESSAGE_SUBSCRIPTION_SYNC_INTERVAL_MS).unref();
};

const REFRESH_TOKEN_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_TOKEN_PURGE_INITIAL_DELAY_MS = 50 * 1000;

const runRefreshTokenPurge = async (): Promise<void> => {
  try {
    const result = await authRepository.purgeExpiredRefreshTokens();
    if (result.count) logger.info("Refresh token auto-purge complete", { deleted: result.count });
  } catch (error) {
    logger.error("Refresh token auto-purge failed", error);
  }
};

/**
 * Permanently removes refresh_tokens rows past their expiry (revoked-but-
 * not-yet-expired rows are left alone - they're already inert, see
 * findValidRefreshToken). Same setInterval pattern as the other schedulers
 * here - no cron library in this codebase.
 */
export const startRefreshTokenPurgeScheduler = (): void => {
  setTimeout(runRefreshTokenPurge, REFRESH_TOKEN_PURGE_INITIAL_DELAY_MS).unref();
  setInterval(runRefreshTokenPurge, REFRESH_TOKEN_PURGE_INTERVAL_MS).unref();
};

const CURRENT_MONTH_INVOICE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CURRENT_MONTH_INVOICE_INITIAL_DELAY_MS = 15 * 1000;

const runCurrentMonthInvoiceGeneration = async (): Promise<void> => {
  try {
    const result = await feeService.generateCurrentMonthInvoices();
    if (result.invoicesCreated) {
      logger.info("Current-month fee invoice generation complete", result);
    }
  } catch (error) {
    logger.error("Current-month fee invoice generation failed", error);
  }
};

/**
 * "Pure Option A" bill-as-you-go billing: bills every currently-enrolled
 * student (across every tenant) for whichever MONTHLY fees have just
 * become due for the current calendar month, so a student's "বকেয়া" never
 * includes months that haven't started yet (see FeeService.
 * generateCurrentMonthInvoices / buildAutoInvoiceRows for the full
 * reasoning). Runs once shortly after boot, then daily - safe to run more
 * than once a day since invoice generation is idempotent per (student,
 * feeStructure, month). Same setInterval pattern as the other schedulers
 * here - no cron library in this codebase, and daily is frequent enough
 * that missing the exact 1st-of-month rollover by up to 24h is harmless.
 */
export const startCurrentMonthInvoiceScheduler = (): void => {
  setTimeout(runCurrentMonthInvoiceGeneration, CURRENT_MONTH_INVOICE_INITIAL_DELAY_MS).unref();
  setInterval(runCurrentMonthInvoiceGeneration, CURRENT_MONTH_INVOICE_INTERVAL_MS).unref();
};

/**
 * Wires SIGTERM/SIGINT to close the HTTP server and the Prisma
 * connection pool cleanly instead of the process being killed mid-request.
 */
export const registerGracefulShutdown = (server: Server): void => {
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info("Shutdown complete");
      process.exit(0);
    });

    // Force-exit if connections don't close in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};
