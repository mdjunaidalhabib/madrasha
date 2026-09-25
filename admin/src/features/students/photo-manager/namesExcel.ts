import { downloadLockedWorkbook } from "../../../utils/excelSheetLock";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import type { DirectoryPerson, PeopleTab } from "./photoManager";
import { LANG_LABEL, NAME_LANGS, nameField, savedValue, type NameOwner } from "./names";

/**
 * Excel round-trip for the নাম (৩ ভাষা) page. The sheet is named after the
 * tab and every column header carries its API key in parentheses
 * ("বাংলা নাম (name_bn)"), so parsing never depends on column order or on the
 * Bangla label text.
 */

const OWNERS: NameOwner[] = ["self", "father", "mother"];
const OWNER_TITLE: Record<PeopleTab, Record<NameOwner, string>> = {
  students: { self: "শিক্ষার্থী", father: "পিতা", mother: "মাতা" },
  teachers: { self: "শিক্ষক", father: "পিতা", mother: "মাতা" },
  staff: { self: "স্টাফ", father: "পিতা", mother: "মাতা" },
};
const SHEET_NAME: Record<PeopleTab, string> = { students: "students", teachers: "teachers", staff: "staff" };
const TAB_TITLE: Record<PeopleTab, string> = { students: "শিক্ষার্থী", teachers: "শিক্ষক", staff: "স্টাফ" };

type Col = { key: string; label: string; locked: boolean; lang?: "bn" | "ar" | "en"; owner?: NameOwner };

const columnsFor = (tab: PeopleTab): Col[] => [
  { key: "id", label: "ID", locked: true },
  { key: "registration_no", label: "রেজি. নং", locked: true },
  ...(tab === "students" ? [{ key: "roll", label: "রোল", locked: true }] : []),
  { key: "subtitle", label: tab === "students" ? "শ্রেণি" : "পদবি", locked: true },
  ...OWNERS.flatMap((owner) =>
    NAME_LANGS.map((lang) => ({
      key: nameField(tab, owner, lang),
      label: `${OWNER_TITLE[tab][owner]} — ${LANG_LABEL[lang]}`,
      locked: false,
      lang,
      owner,
    })),
  ),
];

const border = {
  top: { style: "thin", color: { rgb: "CBD5E1" } },
  bottom: { style: "thin", color: { rgb: "CBD5E1" } },
  left: { style: "thin", color: { rgb: "CBD5E1" } },
  right: { style: "thin", color: { rgb: "CBD5E1" } },
};
const OWNER_FILL: Record<NameOwner, string> = { self: "059669", father: "2563EB", mother: "9333EA" };

export async function downloadNamesTemplate(tab: PeopleTab, people: DirectoryPerson[], scopeLabel: string) {
  const XLSX = await import("xlsx-js-style");
  const cols = columnsFor(tab);

  const cellOf = (p: DirectoryPerson, c: Col) => {
    if (c.key === "id") return p.id;
    if (c.key === "registration_no") return p.regNo ?? "";
    if (c.key === "roll") return p.roll ?? "";
    if (c.key === "subtitle") return p.subtitle ?? "";
    return savedValue(p, c.key);
  };

  const ws = XLSX.utils.aoa_to_sheet([
    [
      `নাম (৩ ভাষা) — ${TAB_TITLE[tab]} · ${scopeLabel} · মোট ${toBanglaDigits(people.length)} জন। ` +
        "ধূসর কলাম (ID, রেজি., রোল, শ্রেণি) লক করা — শুধু নামের ঘরে লেখা যাবে। প্রতিটা নামের কলামে শুধু সেই ভাষায় লিখুন। " +
        "খালি ঘর রাখলে আগের নাম অপরিবর্তিত থাকবে।",
    ],
    cols.map((c) => `${c.label} (${c.key})`),
    ...people.map((p) => cols.map((c) => cellOf(p, c))),
  ]);

  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }];
  ws["!cols"] = cols.map((c) => ({ wch: c.locked ? (c.key === "subtitle" ? 18 : 11) : 26 }));
  ws["!rows"] = [{ hpt: 42 }, { hpt: 34 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 2 };

  ws["A1"].s = {
    font: { bold: true, color: { rgb: "92400E" }, sz: 11 },
    fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } },
    alignment: { vertical: "center", wrapText: true },
  };

  cols.forEach((c, ci) => {
    const head = ws[XLSX.utils.encode_cell({ r: 1, c: ci })];
    if (head)
      head.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: c.locked ? "94A3B8" : OWNER_FILL[c.owner!] } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border,
      };
    for (let r = 0; r < people.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r: r + 2, c: ci })];
      if (!cell) continue;
      cell.s = {
        fill: c.locked ? { patternType: "solid", fgColor: { rgb: "F1F5F9" } } : undefined,
        font: c.locked ? { color: { rgb: "64748B" } } : c.lang === "ar" ? { sz: 13 } : undefined,
        alignment: { horizontal: c.lang === "ar" ? "right" : "left", vertical: "center" },
        border,
      };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME[tab]);
  const safeScope = scopeLabel.replace(/[\\/:*?"<>|]/g, "-").slice(0, 40);
  // ID/রেজি./রোল/শ্রেণি columns and the header are locked - only name cells take input.
  downloadLockedWorkbook(XLSX, wb, `names-${SHEET_NAME[tab]}-${safeScope}.xlsx`, {
    sheetName: SHEET_NAME[tab],
    editableCols: cols.flatMap((c, i) => (c.locked ? [] : [i])),
    firstRow: 3,
    shadeLocked: false,
  });
}

export type ParsedNameRow = { id: number; regNo: string; fields: Record<string, string> };

/** Reads a filled template back. Throws a Bangla message on a wrong file. */
export async function parseNamesFile(file: File, tab: PeopleTab): Promise<ParsedNameRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel ফাইলে কোনো শিট নেই");
  const otherTab = (Object.keys(SHEET_NAME) as PeopleTab[]).find((t) => SHEET_NAME[t] === sheetName && t !== tab);
  if (otherTab) throw new Error(`এই ফাইলটি ${TAB_TITLE[otherTab]} ট্যাবের — ${TAB_TITLE[otherTab]} ট্যাবে গিয়ে আপলোড করুন`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "", raw: false });
  const keyOf = (h: unknown) => /\(([a-z_]+)\)\s*\*?\s*$/i.exec(String(h))?.[1] ?? "";
  const headerIdx = rows.findIndex((r) => r.some((h) => keyOf(h) === "id"));
  if (headerIdx === -1) throw new Error("ফরম্যাট মেলেনি — এই পেজ থেকে ডাউনলোড করা ফরম্যাট ব্যবহার করুন");

  const allowed = new Set(columnsFor(tab).filter((c) => !c.locked).map((c) => c.key));
  const keys = rows[headerIdx].map(keyOf);
  const idCol = keys.indexOf("id");
  const regCol = keys.indexOf("registration_no");

  const out: ParsedNameRow[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const id = Number(String(r[idCol] ?? "").trim());
    if (!Number.isInteger(id) || id <= 0) continue;
    const fields: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (!allowed.has(k)) return;
      const v = String(r[i] ?? "").trim();
      if (v) fields[k] = v; // blank = leave unchanged
    });
    out.push({ id, regNo: regCol === -1 ? "" : String(r[regCol] ?? "").trim(), fields });
  }
  return out;
}

/** Which language a name field belongs to (for the script filter). */
export const langOfField = (tab: PeopleTab, field: string) =>
  columnsFor(tab).find((c) => c.key === field)?.lang;
