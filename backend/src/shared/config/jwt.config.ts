import { env } from "./env";

export const jwtConfig = {
  secret: env.jwtSecret,
  expiresIn: env.jwtExpiresIn,
  refreshTokenExpiresInDays: env.refreshTokenExpiresInDays,
};
