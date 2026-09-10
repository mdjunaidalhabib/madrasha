/**
 * Pure "HH:mm" time-range overlap check, shared by routine.service.ts
 * (room/time conflict) and exam-invigilator.service.ts (invigilator/time
 * conflict) - both need the identical interval-overlap test. Times are
 * fixed-width "HH:mm" strings so lexical comparison is chronological
 * comparison (matches routine.constants.ts's TIME_FORMAT_REGEX).
 */
export const timeRangesOverlap = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean => aStart < bEnd && bStart < aEnd;
