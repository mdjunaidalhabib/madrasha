import { appConfig } from "./app.config";
import { databaseConfig } from "./database.config";
import { jwtConfig } from "./jwt.config";
import { corsConfig } from "./cors.config";
import { rateLimitConfig } from "./rate-limit.config";
import { uploadConfig } from "./upload.config";

export * from "./env";
export * from "./app.config";
export * from "./database.config";
export * from "./jwt.config";
export * from "./cors.config";
export * from "./rate-limit.config";
export * from "./upload.config";

/**
 * Grouped configuration object - the preferred entry point for new code:
 *   import { config } from "@/shared/config";
 *   config.jwt.secret / config.cors.origins / config.database.url ...
 */
export const config = {
  app: appConfig,
  database: databaseConfig,
  jwt: jwtConfig,
  cors: corsConfig,
  rateLimit: rateLimitConfig,
  upload: uploadConfig,
};
