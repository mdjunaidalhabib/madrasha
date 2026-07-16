import { env } from "./env";

export const corsConfig = {
  origins: env.corsOrigins,
  credentials: true,
};
