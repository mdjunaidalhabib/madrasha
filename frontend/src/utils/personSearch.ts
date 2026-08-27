import { normalizeBanglaDigits } from "./reportUtils";

// A Bangladeshi mobile number always starts 01[3-9] - so a phone match only
// kicks in once the typed digits themselves look like the start of one AND
// are long enough to actually narrow the list down. Otherwise a short,
// generic query like "1" or "17" would match almost every phone number in
// the list (nearly all of them contain "01" or "17" somewhere).
const PHONE_QUERY_PATTERN = /^01[3-9]/;
const PHONE_QUERY_MIN_DIGITS = 5;

export type PersonSearchFields = {
  /** Free text fields - name, designation, class/division name, etc. Matched by plain substring. */
  text?: Array<string | number | null | undefined>;
  /** The one field a bare digit query is allowed to match directly (registration_no) - NOT roll/id, which collide too easily (roll "4" exists in nearly every class). */
  registrationNo?: string | number | null;
  /** Phone/mobile fields - matched only under the stricter PHONE_QUERY_* rule above. */
  phones?: Array<string | number | null | undefined>;
};

/**
 * Filters a people list (students/teachers/staff/etc.) by a single search
 * box's query, using one shared set of rules everywhere it's used:
 *
 * - registration_no: an EXACT digit match wins outright - if any row's
 *   registration_no equals the query exactly, only exact hits are kept
 *   (typing "4" for registration_no "4" shouldn't also surface "41", "42",
 *   "43", ...). Falls back to substring matching only when nothing matches
 *   exactly, so a genuine partial-number search still works.
 * - name/designation/class/division text: plain case-insensitive substring.
 * - phone/mobile: only searched once the query looks like the start of a
 *   Bangladeshi mobile number and is long enough to be specific - see
 *   PHONE_QUERY_PATTERN/MIN_DIGITS above.
 *
 * Bangla digits in the query are normalized to English before matching, so
 * both scripts work interchangeably.
 */
export function filterPeopleBySearch<T>(
  items: T[],
  query: string,
  extract: (item: T) => PersonSearchFields,
): T[] {
  const rawKeyword = query.trim();
  if (!rawKeyword) return items;

  const keyword = rawKeyword.toLowerCase();
  const keywordDigits = normalizeBanglaDigits(rawKeyword).replace(/\D/g, "");
  const looksLikePhoneQuery =
    keywordDigits.length >= PHONE_QUERY_MIN_DIGITS && PHONE_QUERY_PATTERN.test(keywordDigits);

  const candidates = items.map((item) => {
    const { text = [], registrationNo, phones = [] } = extract(item);

    const regNo =
      registrationNo !== null && registrationNo !== undefined && registrationNo !== ""
        ? String(registrationNo).toLowerCase()
        : "";
    const isExactId = !!regNo && regNo === keyword;

    const matchesText = text
      .filter((value) => value !== null && value !== undefined && value !== "")
      .some((value) => String(value).toLowerCase().includes(keyword));

    const matchesIdSubstring = !!regNo && regNo.includes(keyword);

    const matchesPhone =
      looksLikePhoneQuery &&
      phones
        .filter((value) => value !== null && value !== undefined && value !== "")
        .map((value) => normalizeBanglaDigits(String(value)).replace(/\D/g, ""))
        .some((digits) => digits.includes(keywordDigits));

    return { item, isExactId, isFuzzy: matchesText || matchesIdSubstring || matchesPhone };
  });

  const hasExactId = candidates.some((candidate) => candidate.isExactId);

  return candidates
    .filter((candidate) => (hasExactId ? candidate.isExactId : candidate.isFuzzy))
    .map((candidate) => candidate.item);
}
