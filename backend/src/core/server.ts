import app from "./app";
import { config } from "../shared/config";
import { logger } from "../shared/logger/logger";
import { syncStartupSuperAdmin } from "./superadmin-bootstrap";
import { startImageCleanupScheduler } from "../shared/storage/image-cleanup";
import {
  verifyDatabaseConnection,
  registerGracefulShutdown,
  registerProcessSafetyNets,
  startTrashPurgeScheduler,
  startActivityLogPurgeScheduler,
  startMessageSubscriptionExpirySync,
  startRefreshTokenPurgeScheduler,
  startCurrentMonthInvoiceScheduler,
  startSmsQueueWorker,
  startAttendanceDeviceJobs,
} from "./bootstrap";

async function start() {
  registerProcessSafetyNets();
  await verifyDatabaseConnection();
  await syncStartupSuperAdmin();

  const server = app.listen(config.app.port, () => {
    logger.info(`Server running on port ${config.app.port}`);
  });

  registerGracefulShutdown(server);
  startTrashPurgeScheduler();
  startImageCleanupScheduler();
  startActivityLogPurgeScheduler();
  startMessageSubscriptionExpirySync();
  startRefreshTokenPurgeScheduler();
  startCurrentMonthInvoiceScheduler();
  startSmsQueueWorker();
  startAttendanceDeviceJobs();
}

start();
