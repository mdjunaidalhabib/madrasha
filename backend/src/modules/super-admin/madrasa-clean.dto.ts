export type MadrasaCleanMode = "operational" | "full";

export const MADRASA_CLEAN_SECTIONS = [
  "students", "fees", "accounts", "exams", "attendance", "personnel", "library", "routines", "logs",
] as const;
export type MadrasaCleanSection = typeof MADRASA_CLEAN_SECTIONS[number];

/** Only explicitly selected sections are cleared in full. */
export function resolveCleanSections(sections: readonly MadrasaCleanSection[]): MadrasaCleanSection[] {
  const selected = new Set(sections);
  return MADRASA_CLEAN_SECTIONS.filter((section) => selected.has(section));
}

/** Double-confirm gate for the irreversible "ক্লিন করুন" action - see
 * madrasa-clean.service.ts cleanMadrasaData. Requires typing the madrasa's
 * exact current name (so the acting super admin is looking at the right
 * tenant) AND the super admin's own login password. */
export interface CleanMadrasaDataRequestDto {
  mode: MadrasaCleanMode;
  confirm_name: string;
  password: string;
  sections?: MadrasaCleanSection[];
}
