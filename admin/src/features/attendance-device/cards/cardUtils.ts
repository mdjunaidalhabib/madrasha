import { normalizeBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import type { CardPerson } from "../types";

/**
 * Card numbers as the backend stores them: ASCII digits, no leading zeros,
 * 1-20 digits, not "0". USB readers often send "0012345678" - that's fine.
 * Returns null when the input isn't a valid card number.
 */
export const normalizeCardInput = (raw: string): string | null => {
  const digits = normalizeBanglaDigits(String(raw ?? "")).replace(/\s+/g, "");
  if (!/^\d{1,20}$/.test(digits)) return null;
  const stripped = digits.replace(/^0+/, "");
  return stripped ? stripped : null;
};

/** Second line under a person's name: class (students) or designation. */
export const personSubtitle = (p: CardPerson) =>
  (p.attendee_type === "STUDENT" ? p.class_name : p.designation) || "";
