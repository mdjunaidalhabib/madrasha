import { Prisma } from "@prisma/client";
import { TransactionClient } from "../database/transaction";
import { createAvailableNumberPool } from "./available-number.util";

type Reader = Pick<TransactionClient, "$queryRaw">;

/** Reservations survive permanent deletion; never read only the live roster. */
export async function getReservedPersonnelNumbers(
  tx: Reader, madrasaId: number, kind: string, scope = "",
): Promise<number[]> {
  const rows = await tx.$queryRaw<{ number: number }[]>(Prisma.sql`
    SELECT number FROM personnel_number_reservations
    WHERE madrasa_id = ${madrasaId} AND kind = ${kind} AND scope = ${scope}
  `);
  return rows.map((row) => row.number);
}

export function createPermanentNumberPool(numbers: number[]) {
  const start = numbers.reduce((max, n) => Math.max(max, n), 0) + 1;
  return createAvailableNumberPool(numbers, start, 2147483647);
}

export async function getNextReservedRoll(
  tx: Reader, madrasaId: number, classId: number, academicYear: string,
) {
  const numbers = await getReservedPersonnelNumbers(tx, madrasaId, "student-roll", `${classId}:${academicYear}`);
  const next = createPermanentNumberPool(numbers).next();
  if (next == null) throw new Error("No available roll number");
  return next;
}
