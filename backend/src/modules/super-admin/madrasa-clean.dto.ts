export type MadrasaCleanMode = "operational" | "full";

/** Double-confirm gate for the irreversible "ক্লিন করুন" action - see
 * madrasa-clean.service.ts cleanMadrasaData. Requires typing the madrasa's
 * exact current name (so the acting super admin is looking at the right
 * tenant) AND the super admin's own login password. */
export interface CleanMadrasaDataRequestDto {
  mode: MadrasaCleanMode;
  confirm_name: string;
  password: string;
}
