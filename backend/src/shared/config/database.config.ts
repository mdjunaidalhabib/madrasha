import { env } from "./env";

export const databaseConfig = {
  url: env.databaseUrl,
  host: env.dbHost,
  user: env.dbUser,
  password: env.dbPass,
  name: env.dbName,
};
