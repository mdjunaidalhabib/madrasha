import { env } from "./env";

export const rateLimitConfig = {
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
};
