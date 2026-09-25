import api, { clearGetCache } from "../../../services/api";
import type { DirectoryPerson, PeopleTab } from "./photoManager";

/** Whose name trio the grid edits. */
export type NameOwner = "self" | "father" | "mother";
export type NameLang = "bn" | "ar" | "en";
export const NAME_LANGS: NameLang[] = ["bn", "ar", "en"];

export const OWNER_LABEL: Record<NameOwner, string> = { self: "নিজের নাম", father: "পিতা", mother: "মাতা" };
export const LANG_LABEL: Record<NameLang, string> = { bn: "বাংলা নাম", ar: "আরবি নাম", en: "English নাম" };

// Students store Arabic as `*arabic_name`, teachers/staff as `*_ar`.
const STUDENT_FIELDS: Record<NameOwner, Record<NameLang, string>> = {
  self: { bn: "name_bn", ar: "arabic_name", en: "name_en" },
  father: { bn: "father_name", ar: "father_arabic_name", en: "father_name_en" },
  mother: { bn: "mother_name", ar: "mother_arabic_name", en: "mother_name_en" },
};
const STAFF_FIELDS: Record<NameOwner, Record<NameLang, string>> = {
  self: { bn: "name_bn", ar: "name_ar", en: "name_en" },
  father: { bn: "father_name", ar: "father_name_ar", en: "father_name_en" },
  mother: { bn: "mother_name", ar: "mother_name_ar", en: "mother_name_en" },
};

/** API field name for a tab/owner/language cell. */
export const nameField = (tab: PeopleTab, owner: NameOwner, lang: NameLang) =>
  (tab === "students" ? STUDENT_FIELDS : STAFF_FIELDS)[owner][lang];

/** Arabic-capable system fonts (the app doesn't load a web Arabic font). */
export const ARABIC_FONT_STACK =
  "'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Segoe UI', 'Geeza Pro', serif";

export const savedValue = (p: DirectoryPerson, field: string): string => {
  const v = p.raw[field];
  return v === null || v === undefined ? "" : String(v);
};

/** Collapses runs of whitespace and trims - what's actually stored. */
export const cleanName = (v: string) => v.replace(/\s+/g, " ").trim();

/**
 * Title-cases an English name typed all-lower or ALL-UPPER ("md abdullah" ->
 * "Md Abdullah"). Mixed-case input (McDonald, al-Hasan) is left as typed.
 */
export const titleCaseEnglish = (v: string) => {
  const s = cleanName(v);
  if (!/[a-z]/i.test(s) || (s !== s.toLowerCase() && s !== s.toUpperCase())) return s;
  return s.toLowerCase().replace(/(^|[\s.\-'])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
};

export type NameChange = { tab: PeopleTab; id: number; fields: Record<string, string> };

const BATCH = 500;
const CONCURRENCY = 4;
/** Fields the teacher/staff bulk endpoint accepts; parent names go through the partial PUT. */
const STAFF_BULK_FIELDS = new Set(["name_bn", "name_ar", "name_en"]);

const toPayload = (c: NameChange) => ({
  id: c.id,
  ...Object.fromEntries(Object.entries(c.fields).map(([k, v]) => [k, v || null])),
});

/**
 * Saves name edits. Own names go through the bulk endpoints
 * (PATCH /students|teachers|staff/names, ≤500 rows per call); a teacher/staff
 * row that also touches father/mother names falls back to their partial PUT.
 * Calls `onResult` per row as results come in.
 */
export async function saveNameChanges(
  changes: NameChange[],
  onResult: (change: NameChange, ok: boolean, message?: string) => void,
) {
  const bulk: Record<PeopleTab, NameChange[]> = { students: [], teachers: [], staff: [] };
  const perRow: NameChange[] = [];
  for (const c of changes) {
    if (c.tab === "students" || Object.keys(c.fields).every((f) => STAFF_BULK_FIELDS.has(f))) bulk[c.tab].push(c);
    else perRow.push(c);
  }

  for (const tab of Object.keys(bulk) as PeopleTab[]) {
    const list = bulk[tab];
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      try {
        await api.patch(`/${tab}/names`, { items: chunk.map(toPayload) });
        chunk.forEach((c) => onResult(c, true));
      } catch (err: any) {
        const message = err?.response?.data?.message;
        chunk.forEach((c) => onResult(c, false, message));
      }
    }
  }

  let cursor = 0;
  const worker = async () => {
    while (cursor < perRow.length) {
      const c = perRow[cursor++];
      try {
        // Partial PUT - "" is stored as null by the teacher/staff services.
        await api.put(`/${c.tab}/${c.id}`, c.fields);
        onResult(c, true);
      } catch (err: any) {
        onResult(c, false, err?.response?.data?.message);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, perRow.length) }, worker));

  if (changes.length) clearGetCache();
}
