/**
 * Small scalar-coercion helpers used when mapping raw request bodies
 * (snake_case, all-strings-from-forms) onto Prisma's typed columns.
 * Previously duplicated with slight drift across students, teacher,
 * accounts, and ResultPanel controllers - centralized here so future
 * modules (and eventually those four, per the migration guide) share
 * one definition.
 */

export const isValidDate = (date?: string | null): boolean => {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
};

/** Normalizes "", undefined, and null to null; leaves everything else as-is. */
export const clean = <T>(value: T): T | null =>
  value === undefined || value === null || (value as unknown) === "" ? null : value;

export const toNumber = (value: unknown, defaultValue: number | null = null): number | null => {
  if (value === undefined || value === null || value === "") return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/** Gender is stored as 1|2 (see Student model) - anything else is treated as unset. */
export const toGenderNumber = (value: unknown): 1 | 2 | null => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  if (num === 1 || num === 2) return num;
  return null;
};

export const toDateOrNull = (value: unknown): Date | null => {
  const v = clean(value as string | null);
  return v ? new Date(v) : null;
};
