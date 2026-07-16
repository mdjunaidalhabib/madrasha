import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Prisma's transaction client - the subset of `prisma` available inside
 * a `$transaction(async (tx) => ...)` callback. Repositories accept this
 * as an optional param so a single repository method can run either
 * standalone or as part of a larger multi-step transaction orchestrated
 * by a service (see students.repository.ts for usage).
 */
export type TransactionClient = Prisma.TransactionClient;

export const withTransaction = <T>(
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> => prisma.$transaction(fn);
