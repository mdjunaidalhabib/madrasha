import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

// Singleton pattern so we don't open a new connection pool on every
// ts-node-dev hot-reload during development.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
