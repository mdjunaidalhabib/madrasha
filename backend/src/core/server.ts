import app from "./app";
import { config } from "../shared/config";
import { logger } from "../shared/logger/logger";
import { verifyDatabaseConnection, registerGracefulShutdown } from "./bootstrap";

async function start() {
  await verifyDatabaseConnection();

  const server = app.listen(config.app.port, () => {
    logger.info(`Server running on port ${config.app.port}`);
  });

  registerGracefulShutdown(server);
}

start();
