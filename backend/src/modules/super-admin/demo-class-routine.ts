import type { Prisma } from "@prisma/client";

/** Six teaching days, with Friday off. No teacher is assigned to a demo. */
export function buildDemoClassRoutines(
  madrasaId: number,
  classIds: number[],
  booksByClassId: ReadonlyMap<number, readonly { subject: string }[]>,
): Prisma.ClassRoutineCreateManyInput[] {
  const rows: Prisma.ClassRoutineCreateManyInput[] = [];
  for (const classId of new Set(classIds)) {
    const subjects = [...new Set((booksByClassId.get(classId) ?? []).map((book) => book.subject))];
    if (!subjects.length) continue;
    const periodsPerDay = 8;
    [6, 0, 1, 2, 3, 4].forEach((dayOfWeek, dayIndex) => {
      for (let period = 0; period < periodsPerDay; period++) {
        // Forty-minute lessons, ten-minute transitions and a twenty-minute break.
        const start = 8 * 60 + period * 50 + (period >= 3 ? 20 : 0);
        const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        rows.push({
          madrasaId, classId, dayOfWeek,
          subject: subjects[(dayIndex * periodsPerDay + period) % subjects.length],
          startTime: time(start), endTime: time(start + 40),
          teacherId: null, isActive: true,
        });
      }
    });
  }
  return rows;
}
