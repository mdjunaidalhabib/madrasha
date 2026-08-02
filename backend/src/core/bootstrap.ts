import { Server } from "http";
import { prisma } from "../shared/database/prisma";
import { logger } from "../shared/logger/logger";
import { trashService } from "../modules/trash/trash.service";

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
    if (result.students || result.teachers || result.exams) {
      logger.info("Trash auto-purge complete", result);
    }
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
