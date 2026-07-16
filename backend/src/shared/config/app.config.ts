import { env } from "./env";

export const appConfig = {
  nodeEnv: env.nodeEnv,
  isProduction: env.nodeEnv === "production",
  port: env.port,
  rootDomain: env.rootDomain,
  jsonBodyLimit: env.jsonBodyLimit,
};
