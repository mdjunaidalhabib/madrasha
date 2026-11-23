import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { withImageLifecycle } from "../storage/image-lifecycle.middleware";

dotenv.config();

// Singleton pattern so we don't open a new connection pool on every
// ts-node-dev hot-reload during development.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// This query-only extension adds no model/result/client methods. Keep the
// existing PrismaClient/TransactionClient contract used by repositories.
export const prisma: PrismaClient =
  global.__prisma ||
  withImageLifecycle(new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
