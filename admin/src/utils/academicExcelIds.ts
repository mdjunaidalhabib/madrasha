import type { WorkBook } from "xlsx";

export interface AcademicExcelReference {
  id: number | string;
  local_no?: number | null;
  /** Actual parent ID and its visible path, e.g. division 2 or class 2/1. */
  scope_id?: number | null;
  scope_key?: string;
  parent_fields?: string[];
}

const MAP_SHEET = "__AcademicIds";
const MAP_VERSION = "edin_local_academic_ids_v2";

export class AcademicExcelIdError extends Error {
  constructor(
    public readonly row: number,
    public readonly field: string,
    public readonly value: string,
  ) {
    super("Unknown institution-local academic number");
  }
}

export function academicExcelId(reference: { local_no?: number | null } | undefined): number {
  const value = reference?.local_no;
  if (value == null || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(
      "Institution-local academic numbers are unavailable. Reload and download a new template.",
    );
  }
  return value;
}

export function academicExcelValue(
  references: AcademicExcelReference[],
  recordId: unknown,
): number | string {
  if (recordId == null || String(recordId).trim() === "") return "";
  const reference = references.find((r) => String(r.id) === String(recordId));
  const number = academicExcelId(reference);
  return reference?.scope_key ? `${reference.scope_key}/${number}` : number;
}

/** Hidden versioned map keeps existing API IDs separate from visible local numbers. */
export function appendAcademicExcelIds(
  XLSX: typeof import("xlsx-js-style"),
  workbook: WorkBook,
  fields: Record<string, AcademicExcelReference[]>,
) {
  const rows: (string | number)[][] = [
    [MAP_VERSION],
    ["field", "local_no", "record_id", "scope_id", "scope_key", "parent_fields"],
  ];
  for (const [field, references] of Object.entries(fields)) {
    for (const reference of references)
      rows.push([
        field,
        academicExcelId(reference),
        Number(reference.id),
        reference.scope_id ?? "",
        reference.scope_key ?? "",
        (reference.parent_fields ?? []).join(","),
      ]);
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), MAP_SHEET);
  workbook.Workbook ??= {};
  workbook.Workbook.Sheets ??= workbook.SheetNames.map((name) => ({ name, Hidden: 0 }));
  const index = workbook.SheetNames.indexOf(MAP_SHEET);
  workbook.Workbook.Sheets[index] = { name: MAP_SHEET, Hidden: 2 };
}

const normalizeDigits = (value: unknown) =>
  String(value)
    .trim()
    .replace(/[\u0980-\u09ff]/g, (digit) =>
      digit.charCodeAt(0) >= 0x09e6 && digit.charCodeAt(0) <= 0x09ef
        ? String(digit.charCodeAt(0) - 0x09e6)
        : digit,
    );

export function resolveAcademicExcelIds<T>(
  XLSX: Pick<typeof import("xlsx"), "utils">,
  workbook: Pick<WorkBook, "Sheets">,
  rows: T[],
  firstDataRow = 2,
): T[] {
  const sheet = workbook.Sheets[MAP_SHEET];
  if (!sheet) return rows; // Existing unmarked workbooks retain their original API IDs.
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: false });
  if (![MAP_VERSION, "edin_local_academic_ids_v1"].includes(data[0]?.[0]))
    throw new Error("Invalid academic ID map");
  type Entry = { key: string; id: number; scopeId?: number; scopeKey: string; parents: string[] };
  const fields = new Map<string, Entry[]>();
  for (const [field, localNo, recordId, scopeId, scopeKey, parentFields] of data.slice(2)) {
    const key = normalizeDigits(localNo);
    const id = Number(recordId);
    if (
      !field ||
      !Number.isSafeInteger(Number(key)) ||
      Number(key) < 1 ||
      !Number.isSafeInteger(id) ||
      id < 1
    )
      throw new Error("Invalid academic ID map");
    const scope = scopeId == null || scopeId === "" ? undefined : Number(scopeId);
    if (scope !== undefined && (!Number.isSafeInteger(scope) || scope < 0))
      throw new Error("Invalid academic ID map");
    if (!fields.has(field)) fields.set(field, []);
    const entries = fields.get(field)!;
    const path = normalizeDigits(scopeKey ?? "");
    if (
      entries.some(
        (e) =>
          e.key === key &&
          (e.scopeId === scope || (path !== "" && e.scopeKey === path)) &&
          e.id !== id,
      )
    )
      throw new Error("Ambiguous academic ID map");
    entries.push({
      key,
      id,
      scopeId: scope,
      scopeKey: path,
      parents: String(parentFields ?? "")
        .split(",")
        .filter(Boolean),
    });
  }
  return rows.map((row, index) => {
    const copy = { ...row } as Record<string, unknown>;
    const resolved = new Set<string>();
    const visiting = new Set<string>();
    const resolveField = (field: string): void => {
      if (resolved.has(field)) return;
      if (visiting.has(field)) throw new Error("Invalid academic ID map");
      visiting.add(field);
      const value = copy[field];
      if (value != null && String(value).trim() !== "") {
        const entries = fields.get(field) ?? [];
        const parents = [...new Set(entries.flatMap((e) => e.parents))];
        const parentIds = parents
          .filter((p) => copy[p] != null && String(copy[p]).trim() !== "")
          .map((p) => {
            if (fields.has(p)) resolveField(p);
            return Number(copy[p]);
          });
        const key = normalizeDigits(value);
        const matches = entries.filter((e) => {
          const valueMatches = key.includes("/") ? `${e.scopeKey}/${e.key}` === key : e.key === key;
          return (
            valueMatches &&
            (parentIds.length === 0 ||
              e.scopeId === undefined ||
              parentIds.every((id) => id === e.scopeId))
          );
        });
        const ids = [...new Set(matches.map((e) => e.id))];
        if (ids.length !== 1)
          throw new AcademicExcelIdError(firstDataRow + index, field, String(value));
        copy[field] = ids[0];
      }
      visiting.delete(field);
      resolved.add(field);
    };
    for (const field of fields.keys()) resolveField(field);
    return copy as T;
  });
}
